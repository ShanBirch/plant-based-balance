/* Plain-language teaching through the free-energy/active-inference framework.
 * Sources and boundaries: docs/learn-eight-weeks.md. Existing IDs preserve credit.
 */
(function(root) {
  'use strict';
  const rows = [
    ['mind-6-1','Make the choice easier',
      `Self-control is a useful name for processes involved in regulating behaviour. It is not a single magical resource that some people possess and others lack. Predictive-processing and active-inference models offer a way to consider how expectations, goals and context interact with action.\n\nAt the gym, an unfamiliar room and a complicated plan can make starting harder. Booking a short introduction and choosing a familiar movement changes the situation in which the decision happens. You can still plan and deliberate; the environment helps those efforts.\n\nNotice one point of friction in your own routine. Change that specific part, then see whether starting becomes more manageable. The outcome is evidence about the plan, not a verdict on your character.`,
      'Support self-regulation with a specific change to the situation.',
      'Starting feels difficult in an unfamiliar gym. What is a useful experiment?',['Decide that self-control cannot exist','Arrange a short introduction and familiar first movement','Blame a lack of character'],1,
      'A specific change lets you test whether the situation becomes more manageable.',
      'Calling behaviour predictive proves that self-control does not exist.',false],
    ['mind-6-2','Automatic reactions and deliberate plans',
      `An expectation of judgement may arrive before you consciously choose it. You can notice it and plan a supported visit anyway. Automatic reactions and deliberate planning are both part of what the brain does.\n\nActive inference models can describe how possible actions are considered in relation to expected outcomes, preferences and uncertainty. They do not establish that every conscious decision is a powerless narration of an action already determined.\n\nStay with the gym example: you cannot guarantee an immediate feeling of confidence. You can decide on a time, ask for help and observe how the visit unfolds. Those actions change what information becomes available. The useful question is which part of this process you can influence next.`,
      'Not choosing a first reaction does not mean that planning and action have no effect.',
      'An anxious first impression arises automatically. What follows?',['Every next action is beyond influence','A deliberate plan can still help shape the next experience','The feeling must be ignored'],1,
      'The automatic impression does not establish that planning is ineffective.',
      'The free-energy principle settles the philosophical question of free will.',false],
    ['mind-6-5','People Are Your Strongest Environment',
      `The people around you are part of what your brain learns from.\n\nOne long-term study found that when someone's friend became obese, their own likelihood of becoming obese increased by 57%. That was a relative increase in an observational study, not 57 percentage points or a prediction for every friendship. The study did not establish that changes in brain predictions caused the association. Source: Christakis and Fowler, The Spread of Obesity in a Large Social Network over 32 Years (2007), doi:10.1056/NEJMsa066082.\n\nThat doesn't mean you automatically become like your friends. But it shows why our social environment deserves attention.\n\nThrough a predictive-brain lens, the idea is this: your brain learns what to expect from repeated experience. And other people are part of that experience. What they eat. How they move. What they make time for. Those experiences can shape what feels normal, and what you see as possible for yourself.\n\nSo if you're trying to build an exercise routine, give yourself opportunities to spend time with people who make being active part of everyday life. Join their walk. Arrange a workout together. Ask them to show you where to start. You're giving yourself something new to learn from.\n\nFor this week's action, take part in the Balance Feed. Across the week, share three posts about a meal, workout or walk. Leave a meaningful comment on three other people's posts. A PB share can be one of your three posts; a PB is not required. In your weekly check-in, describe what you shared, your interactions and whether participating changed your motivation or what you actually did. If nothing changed, record that too.`,
      'Other people are part of what you learn from: change what you experience together, then notice what changes for you.',
      'What does the 57% finding mean?',['Every person has a 57% chance of becoming obese','The study found a relative increase associated with a friend becoming obese','The study proved a brain mechanism that makes friends alike'],1,
      'The finding is a relative association in that study, not a guaranteed individual outcome or proof of a brain mechanism.',
      'Spending time with active people guarantees that you will automatically become fitter.',false],
    ['mind-4-2','Practise a repeatable pattern',
      `A manageable gym visit gives you an opportunity to practise again. Repetition in a relevant context can help build a familiar routine, but the brain does not count frequency while ignoring intensity, outcome or context. Learning depends on what is experienced and how it is processed.\n\nFor the person expecting judgement, several short supported visits may provide clearer evidence than a single exhausting visit. That is a practical choice about this situation, not a rule that frequent small experiences always teach more than an intense one.\n\nChoose a routine you can revisit, notice the outcome and adjust it if needed. Consistency means returning often enough to practise; it does not require ignoring recovery or making every day identical.`,
      'Repeat a manageable routine and use the outcome to guide the next attempt.',
      'What makes repeated visits useful in this example?',['Frequency is the only thing the brain tracks','Repeated relevant opportunities to practise and observe','Each visit must be more exhausting'],1,
      'The repeated opportunity supplies experience; its context and outcome still matter.',
      'The brain updates based on frequency alone and never on intensity or context.',false],
    ['mind-4-5','Returning matters more than a perfect streak',
      `A streak can make a routine visible and encourage you to return. It is feedback about repeated behaviour, not a direct measurement of a neural prediction or a requirement for learning. Missing a day does not erase previous learning.\n\nIf a gym visit is interrupted by work, the next useful question is how to return. A shorter visit, a different day or a planned rest may fit better than trying to preserve a number at any cost.\n\nKeep the evidence specific: you practised before, circumstances changed, and you are choosing the next workable opportunity. A sustainable pattern includes interruptions and recovery. You can practise restarting as part of the routine itself.`,
      'An interrupted streak does not erase learning; practise a realistic return.',
      'You miss a planned visit because of work. What supports the routine?',['Treat all previous learning as erased','Choose the next realistic opportunity','Train through every problem to preserve a number'],1,
      'A practical return keeps the routine workable without treating an interruption as failure.',
      'Missing one day erases the brain’s previous learning.',false],
    ['mind-3-1','Your brain infers the causes',
      `Your brain sits inside your skull. It receives changing signals from your eyes, ears and body; it does not receive a labelled picture of what caused them. A generative model is a way of describing its learned expectations about how causes produce those signals. Predictive processing proposes that the brain uses this model alongside incoming evidence to infer what is happening.\n\nImagine arriving at an unfamiliar gym. You hear laughter and see two people looking towards you. Those signals do not contain the label "they are judging me". Your history and the current context help shape that interpretation. They might be laughing about their own conversation.\n\nThe experience is real, but its interpretation is open to revision. This does not mean the outside world is invented or that sensory evidence is irrelevant.`,
      'A signal and your interpretation of its cause are different things.',
      'What is directly observed in the gym example?',['People laughed and looked in your direction','They definitely judged you','The gym is unsafe'],0,
      'The observation is laughter and a glance. Their intention is an inference, not a directly observed fact.',
      'A generative model describes expectations about how causes produce signals.',true],
    ['mind-3-2','The past supplies expectations',
      `If past gym visits involved criticism, a glance can fit an expectation of judgement. If past visits involved encouragement, the same glance might seem welcoming. In this framework, a prior is an expectation before the current evidence is taken into account. It need not be a thought you consciously chose.\n\nStrong expectations can be useful when they fit the situation. They can also carry an old pattern into a new place. An understandable expectation is not automatically an accurate description of today.\n\nAt this gym, try distinguishing "I expect judgement because of my history" from "I know these people are judging me". The distinction leaves room for evidence. New experiences may gradually revise the expectation; you do not have to force yourself to feel confident first.`,
      'A learned expectation helps interpret the present, but it is not proof about the present.',
      'Past gym criticism makes a new glance feel hostile. What is the useful distinction?',['The past proves what these people think','The expectation has a history; the present still needs evidence','Ignore all previous experience'],1,
      'Past experience explains the expectation without establishing another person’s present intention.',
      'An expectation can arise before you consciously choose it.',true],
    ['mind-3-3','Body signals need context',
      `Your heart is beating faster at the gym door. A faster heartbeat alone does not specify one emotion. Exercise, anticipation, caffeine and anxiety can all involve a faster heart rate. Interoception means sensing and interpreting signals from inside the body.\n\nThe theory of constructed emotion proposes that the brain draws on bodily signals, context and learned concepts to construct an emotional experience. This is an influential account, not the only scientific account of emotion.\n\nYou can notice "fast heartbeat, unfamiliar room, expecting judgement" before settling on a label. A more specific description can help you decide what to do next: ask for an introduction, start gently or take a pause. It does not require denying the feeling or assuming a physical symptom is harmless.`,
      'Body signals contribute real evidence; context helps you interpret them.',
      'A fast heartbeat at the gym proves which interpretation?',['Anxiety, every time','Excitement, every time','No single interpretation without more context'],2,
      'One body signal can occur in several situations. Consider context and other information.',
      'Constructed emotion is one scientific theory, rather than the only possible account.',true],
    ['mind-3-4','Context changes the prediction',
      `Keep the person and the gym the same. Now change the visit: a quieter time, a familiar exercise and a supportive introduction. The sensory and social context has changed, so the same person has different evidence available.\n\nIn predictive-processing terms, context helps determine which learned expectations are relevant and how much confidence to place in the signals. This is why "I could do it yesterday" does not guarantee that it feels identical today.\n\nChanging context is also a practical experiment. If the quieter visit feels more manageable, that tells you something about the situation. It does not prove every future visit will be easy. Notice what changed and what stayed the same before deciding what the result means.`,
      'Change one part of the context and observe what difference it makes.',
      'A quieter gym visit felt easier. What can you reasonably conclude?',['Every future visit will be easy','That context may have helped on this visit','Your earlier discomfort was fake'],1,
      'The result is useful evidence about this context, not a guarantee or a reason to dismiss earlier feelings.',
      'The same person can experience the same place differently when the context changes.',true],
    ['mind-3-5','Give the expectation new evidence',
      `You expected every gym visit to end in judgement. On a short visit, a staff member helps and you complete a familiar exercise. That outcome does not fit the original expectation.\n\nThe useful question is not "Why am I still nervous?" It is "What did I predict, what actually happened, and what does this suggest for next time?" You might revise "every visit will be awful" to "a short supported visit can be manageable". That is a specific update rather than a demand for instant confidence.\n\nOne experience may be treated as an exception. Further relevant experiences can help establish whether the pattern is reliable. If a visit really is unpleasant, record that too and adjust the setting or support. Learning needs honest evidence, not forced positive thinking.`,
      'Use the actual outcome to make the next expectation more specific.',
      'One supported visit went well. Which update fits the evidence?',['I will never feel nervous again','A short supported visit can be manageable','I must pretend every visit is positive'],1,
      'A specific expectation reflects the observation without overgeneralising.',
      'Only positive outcomes should be included in a learning experiment.',false],
    ['mind-7-1','What the free-energy principle proposes',
      `The free-energy principle is a theoretical framework associated with Karl Friston. It describes how a system can maintain its organisation through exchanges with its surroundings. Applied to the brain, it motivates models in which perception, learning and action work together.\n\nStatistical surprise means how unlikely an observation is under a model. A prediction error is a mismatch between a prediction and an observation. Variational free energy is a mathematical quantity used to approximate inference; it bounds statistical surprise. These are related ideas, not interchangeable names. "Free energy" here is not a calorie counter.\n\nAt the gym, unexpectedly friendly help is evidence that your current expectation may not explain this visit well. The framework asks how beliefs and actions can respond to that evidence. It does not establish that the brain has only one literal job or predicts the entire universe.`,
      'Use the framework to connect inference, learning and action; distinguish its technical terms.',
      'What does free energy mean in this explanation?',['The calories left in your brain','A mathematical quantity used in inference','How emotionally shocked you feel'],1,
      'Variational free energy belongs to the mathematical model; it is not a direct measure of calories or felt shock.',
      'Statistical surprise and a prediction error are related but distinct concepts.',true],
    ['mind-7-2','Update a belief or take an action',
      `At the gym door you cannot tell whether the class is suitable. You could revise a belief as you read the class description. You could also ask the instructor and obtain better information. Both perception and action can change what happens next in the inference loop.\n\nSome actions help meet a need directly: drinking when thirsty, for example. Other actions help resolve uncertainty: checking where the water fountain is. Active-inference models consider possible actions in relation to preferred outcomes and information they may provide.\n\nThis is richer than "make the world confirm whatever you believe". If you expect rejection, asking a question might disconfirm that expectation. The point is to navigate and learn about the situation, not to manufacture proof that a fearful prediction was right.`,
      'Actions can meet a need, obtain information, or do both.',
      'You ask the instructor whether the class suits beginners. What can that action provide?',['Information that may change your expectation','Proof that all expectations are correct','A way to avoid every new observation'],0,
      'The answer gives evidence about the class and may help you choose a suitable next action.',
      'Active inference only means forcing reality to confirm an existing belief.',false],
    ['mind-7-3','Precision: how much weight does evidence get?',
      `Not every mismatch deserves the same update. A clear instruction from the class teacher carries different evidence from a sentence you barely heard across the room. In these models, precision describes confidence or reliability, often represented mathematically as inverse variance.\n\nAn update depends on the relative confidence in the prior expectation and the new evidence. A surprising but unreliable observation may change little. Clear, relevant evidence may change more. Attention is related to precision weighting in predictive-processing accounts, although attention has more than one scientific explanation.\n\nAfter the helpful gym visit, ask: was this a clear observation? Was this context relevant to my next visit? "Bigger surprise always causes bigger learning" misses this weighting step.`,
      'The size of a mismatch and the reliability assigned to it both matter.',
      'Which evidence is usually more informative about a class?',['A barely heard comment with unclear context','The instructor clearly describing its level','Whichever statement feels most dramatic'],1,
      'A clear, relevant source provides stronger evidence than an ambiguous fragment.',
      'The largest mismatch always produces the largest learning update, regardless of reliability.',false],
    ['mind-7-4','Why a predictive brain explores',
      `If the brain only avoided surprises, why would anyone try a new gym? Active-inference models include the value of obtaining information. A little uncertainty now can help reduce uncertainty about useful choices later.\n\nA short tour may not be your workout, but it can tell you where to go, who to ask and whether the space suits you. This is sometimes called epistemic value: the value of learning something. Meeting a practical need is often called pragmatic value. One action can have both.\n\nThe body also needs food, movement, rest and other conditions that cannot be met by hiding from all changing input. The free-energy perspective does not imply sitting still and confirming every belief. Curiosity and exploration belong in the explanation too.`,
      'An informative action can be worth taking even when it introduces some uncertainty now.',
      'Why might a gym tour be useful before a workout?',['It removes all future uncertainty','It supplies information for later choices','It proves the brain cannot learn'],1,
      'The tour can make later choices better informed without guaranteeing a particular outcome.',
      'Information seeking is part of active-inference models.',true],
    ['mind-7-5','You are part of the loop',
      `Follow the gym example as one loop: past experience shapes an expectation; sensory and bodily signals arrive; the brain interprets them; an action changes what you encounter next; new evidence can inform the model. This happens across interacting processes and timescales, rather than as a single conscious checklist.\n\nYou do not consciously choose every first impression or urge. That does not establish that deliberation and planning have no effect. Planning a quieter visit, asking for help and reflecting afterwards are themselves activities within the brain-body-environment system.\n\nFor practice, use the checklist to inspect one part of the loop. What did you expect? What action did you take? What evidence came back? Next we look more closely at learning: what changes in the model so a later prediction can be different?`,
      'You can influence the conditions for learning without choosing every automatic reaction.',
      'You cannot instantly choose to feel confident. What still fits this framework?',['Nothing you do can matter','Plan a supported visit and observe the outcome','Every conscious plan is scientifically proven useless'],1,
      'Planning and acting are part of the system and can change the evidence available next time.',
      'Automatic first impressions prove that planning cannot influence behaviour.',false],
    ['mind-8-1','Learning changes the model',
      `From a free-energy perspective, learning changes the model used to make future inferences. There is an important distinction: inference estimates what is happening now; learning updates longer-lasting parameters or relationships that help explain later observations.\n\nAt the gym, "this instructor is friendly today" is an inference about this visit. After several relevant experiences, "asking staff for help often works here" is a learned expectation that can affect your next visit.\n\nCalling this an algorithm is a useful computational description. It does not mean a tiny programmer edits code inside your head. In brain implementations, learning involves changes in neural connections and other processes across timescales. Free-energy and predictive-processing models offer one account of how those changes may be organised.`,
      'Inference estimates the current situation; learning changes what the model can predict later.',
      'Which example best describes a longer-lasting model update?',['This room is noisy right now','I now expect asking the staff for help to be useful','I noticed a sound once without any change in expectation'],1,
      'The revised expectation can influence a future visit, beyond interpreting this moment.',
      'Learning in this account means a tiny programmer literally rewrites brain code.',false],
    ['mind-8-2','Why surprise can trigger an update',
      `You predicted that asking for help would end badly. The instructor instead explains the equipment patiently. The observation does not fit the prediction: there is a prediction error. In predictive-coding models, error signals can guide changes in beliefs and learned parameters.\n\nA simple teaching sketch is: next estimate = current estimate + learning rate × prediction error. This illustrates an update, not the complete brain algorithm. More general free-energy models adjust parameters in directions that reduce variational free energy, balancing how well observations are explained with changes relative to prior beliefs.\n\nWhy update? The old model was a poorer explanation of the evidence. A revised model may support better inference and action next time. Surprise need not feel dramatic or unpleasant, and noticing a mismatch does not guarantee a lasting update.`,
      'A mismatch can supply an update signal when the existing model does not fit the evidence.',
      'A helpful response contradicts expected rejection. What is the prediction error?',['The difference between the expected and observed response','Any strong emotion, regardless of expectation','Proof that all old beliefs must be discarded'],0,
      'The mismatch is between the predicted response and the actual response; its implications still need weighing.',
      'The simple learning-rate equation is the complete algorithm used by every brain process.',false],
    ['mind-8-3','How much does the model change?',
      `Suppose your estimate was that a short gym visit would feel 8 out of 10 difficult, and this visit felt 4. In a simple illustrative update, a learning rate of 0.25 would move the next estimate from 8 to 7: 8 + 0.25 × (4 − 8). These numbers explain the idea; they are not a measurement of your brain.\n\nWhy not immediately jump to 4? You might have a strong prior, uncertain evidence, or good reason to think this was an unusual context. Reliability, uncertainty and whether the situation has changed can affect learning in computational models.\n\nRepeated relevant outcomes can shift confidence. But repetition alone is not a promise of change, and the largest shock is not automatically the best lesson. Make the observation clear and the next expectation specific.`,
      'Updating is weighted: the same mismatch can lead to different changes depending on confidence and context.',
      'In the example, 8 + 0.25 × (4 − 8) gives which new estimate?',['4','7','12'],1,
      'The mismatch is −4; one quarter is −1, so the estimate moves from 8 to 7.',
      'Those example numbers reveal a member’s actual neural learning rate.',false],
    ['mind-8-4','Why new evidence sometimes does not change us',
      `The visit went well, but you think "that was just luck". Your model can explain away the outcome as an exception instead of changing a broad expectation. Avoiding the next visit also prevents new evidence from arriving. Selective attention can leave successes out of the record.\n\nThese are useful ways to examine resistance through this framework. They are not proof that all disagreement or confirmation bias is caused by saving glucose. Social concerns, incentives, uncertainty and the quality of the evidence can matter too.\n\nAsk whether the outcome was reliable and relevant, rather than demanding that you believe it. Try another manageable visit if appropriate. Include outcomes that do not support your preferred story. A model that only accepts flattering evidence is not becoming better informed.`,
      'Examine how evidence is sampled and interpreted, including whether it is dismissed as an exception.',
      'A good visit is dismissed as luck. What is a useful next step?',['Insist the person must feel positive','Check the evidence and test another manageable visit','Explain all doubt as glucose conservation'],1,
      'Another relevant observation can help test whether the result was an exception or a repeatable pattern.',
      'Free-energy theory proves that every refusal to learn is caused by saving glucose.',false],
    ['mind-8-5','Run the update loop yourself',
      `Choose one manageable prediction you can test in real life. Stay with the gym example: "If I ask for help, I expect a dismissive response." Write the expectation before acting so the outcome cannot quietly rewrite what you remember predicting.\n\nTake the planned action. Record the actual response, including anything uncertain. Compare prediction and outcome. Consider how reliable and relevant the evidence is. Then write a proportionate next prediction: "This instructor helped today; I can try asking a clear question again."\n\nThat is the practical sequence: predict, act or observe, compare, weigh, update, test again. It is not a guarantee that the feeling changes immediately. A neutral or difficult result still counts as evidence. The aim is to make the next model better informed, then use that understanding when building repeatable routines.`,
      'Predict, observe, compare, weigh the evidence, update, and test again.',
      'What makes a useful learning record?',['Only recording successes','Recording expectation, actual outcome, reliability and a revised expectation','Writing the expected result after seeing what happened'],1,
      'The record separates the prior prediction from the observation and explains a proportionate update.',
      'An experiment only counts if it produces a positive result or removes discomfort.',false]
  ];
  // Additional lesson-specific practice; tuple = question, choices, answer index, feedback.
  const practice = {
    'mind-6-1': [
      ['Which part of an unfamiliar gym visit could you change first?', ['Your entire personality','The first exercise and who can show you how','Every feeling before you arrive'],1,'A familiar first movement and available help reduce a specific source of uncertainty.'],
      ['A short introduction helped you start. What did the experiment tell you?', ['Support may make this situation more manageable','You will never need to plan again','All difficulty was imaginary'],0,'The result concerns the situation you tested, not every future visit.'],
      ['What should guide your next adjustment?', ['Whether you showed perfect willpower','Whether the visit looked impressive','The specific point where starting became difficult'],2,'Identifying the point of friction gives you something concrete to change.']
    ],
    'mind-6-2': [
      ['You feel judged before speaking to anyone. Which part can you influence next?', ['Guarantee that anxiety disappears','Arrange a supported visit and observe it','Choose what everyone else thinks'],1,'A plan can change the next experience even when the first reaction was automatic.'],
      ['Where does deliberate planning fit in this account?', ['It is part of how the brain considers possible actions','It happens outside the brain','It proves automatic reactions do not exist'],0,'Automatic reactions and deliberate plans are both activities of the brain.'],
      ['What would count as useful information after your planned visit?', ['Only a completely confident feeling','Only evidence that agrees with your first impression','What happened when you asked for help'],2,'The outcome can inform the next plan without requiring an immediate emotional change.']
    ],
    'mind-6-5': [
      ['Through a predictive-brain lens, why do other people matter?', ['They choose all your future behaviour','Their everyday actions are part of the experience you learn from','Their fitness transfers directly to you'],1,'What people do can help shape your expectations about what is normal and possible.'],
      ['Which action puts this lesson into practice?', ['Share three meal, workout or walk posts and comment on three other posts','Wait for their habits to transfer without taking part','Publish their identity in your check-in'],0,'Participating in the Feed gives you a specific social experience to reflect on in your check-in.'],
      ['Which check-in best captures the experiment?', ['My friend guarantees I will keep training','I must say it helped even if nothing changed','I shared three posts, commented on three others and noticed no change in motivation'],2,'Record what you shared, how the interactions felt and what changed or stayed the same. A neutral outcome counts too.']
    ],
    'mind-4-2': [
      ['Why might short, supported visits be useful for someone expecting judgement?', ['They guarantee confidence after three visits','They offer manageable opportunities to observe what happens','Their frequency is the only thing that matters'],1,'Relevant repeated experiences can supply evidence while keeping the task manageable.'],
      ['What matters alongside how often you practise?', ['The context and outcome of the experience','Only the length of the streak','Whether each session is harder than the last'],0,'Learning depends on what happens and how it is processed, not repetition alone.'],
      ['Work interrupts your usual visit. What fits a repeatable routine?', ['Ignore recovery to preserve the schedule','Abandon the routine permanently','Choose a realistic next opportunity to practise'],2,'A workable routine allows adjustments and recovery as well as repetition.']
    ],
    'mind-4-5': [
      ['What does an app streak directly show?', ['How many neural connections changed','A record of repeated behaviour','Whether you will always succeed'],1,'A streak is behavioural feedback, not a direct measurement of brain change.'],
      ['You cannot fit your usual workout into today. What could help you return?', ['Choose a shorter visit or another realistic day','Treat previous practice as wasted','Avoid planning until motivation returns'],0,'An adjustment can preserve a workable pattern without protecting the number at all costs.'],
      ['Why practise restarting?', ['To make interruptions impossible','To prove you never need rest','Because interruptions can be part of a sustainable routine'],2,'Returning after interruptions is itself a useful skill to practise.']
    ],
    'mind-3-1': [
      ['What does a generative model describe here?', ['A conscious list of every future event','Learned expectations about how causes produce signals','A labelled image sent directly into the brain'],1,'The model relates possible causes to the signals they could produce.'],
      ['You hear laughter at the gym. Which is another possible explanation?', ['The people are laughing about their own conversation','The sound proves they dislike you','Your senses created people who are not there'],0,'The same observation can fit more than one explanation.'],
      ['What could help distinguish between interpretations?', ['Treating the first interpretation as certain','Ignoring all sensory information','Taking account of further relevant evidence'],2,'Incoming evidence can help revise an interpretation; it is not fixed by the first impression.']
    ],
    'mind-3-2': [
      ['What is a prior in this lesson?', ['Proof of what another person intends','An expectation before current evidence is considered','A decision that must be conscious'],1,'A prior is a starting expectation, not a guaranteed conclusion.'],
      ['Two people interpret the same glance differently. What may contribute?', ['Different past experiences','One glance must have two physical directions','History never affects interpretation'],0,'Past experiences can supply different expectations about a similar signal.'],
      ['How can you leave room for learning during a new visit?', ['Assume every visit repeats the past','Force confidence before entering','Separate what you expect from what you actually observe'],2,'Distinguishing expectation from observation leaves room for evidence to revise the expectation.']
    ],
    'mind-3-3': [
      ['What does interoception refer to?', ['Reading other people\'s intentions','Sensing and interpreting signals inside the body','Ignoring bodily sensations'],1,'Interoception concerns internal bodily signals and their interpretation.'],
      ['Which description keeps the available information specific?', ['Fast heartbeat, unfamiliar room, expecting judgement','A fast heartbeat can only mean danger','My body signals are not real'],0,'A specific description brings body signals and context together without assuming one meaning.'],
      ['What does this lesson suggest doing with that information?', ['Assume every physical symptom is harmless','Deny the feeling until it goes away','Consider a suitable next step, such as asking for an introduction'],2,'Context can help guide an action without dismissing a feeling or a physical symptom.']
    ],
    'mind-3-4': [
      ['Which change would test the context of a difficult gym visit?', ['Demand an identical feeling every day','Visit at a quieter time','Decide yesterday proves what today must be like'],1,'A quieter time changes one part of the situation you can observe.'],
      ['Why can the same gym feel different on another day?', ['The available signals and relevant expectations can differ','Past experience stops existing overnight','A place always produces exactly one feeling'],0,'Context affects which expectations and evidence are relevant now.'],
      ['What should you compare after changing the visit?', ['Only whether you felt perfect','Only what you hoped would happen','What changed and what stayed the same'],2,'Comparing the actual conditions and outcomes helps interpret the experiment.']
    ],
    'mind-3-5': [
      ['You expected judgement but a staff member helped. What should you compare?', ['Your performance with everyone else\'s','What you predicted with what actually happened','Only your remaining nervousness'],1,'The comparison makes the new evidence visible even if the feeling has not vanished.'],
      ['Why might further visits be useful?', ['To see whether the supported experience forms a reliable pattern','To erase every unpleasant memory','To prove all gyms are welcoming'],0,'One experience may be treated as an exception; further relevant evidence helps test the pattern.'],
      ['A visit really is unpleasant. What fits this approach?', ['Leave it out of the record','Insist it was secretly positive','Record it and consider changing the setting or support'],2,'Learning requires honest evidence, including difficult outcomes.']
    ],
    'mind-7-1': [
      ['What does statistical surprise describe?', ['How dramatic an emotion feels','How unlikely an observation is under a model','How many calories the brain uses'],1,'Statistical surprise concerns probability under a model, not felt shock.'],
      ['What is a prediction error?', ['A mismatch between a prediction and an observation','Any conscious choice','A measure of physical tiredness'],0,'Prediction error refers to a mismatch; it is related to, but not identical with, free energy.'],
      ['How is the free-energy principle presented in this lesson?', ['Proof that the brain has one literal job','A calorie-management plan','A theoretical framework linking perception, learning and action'],2,'It is a framework for modelling how systems maintain themselves through exchanges with their surroundings.']
    ],
    'mind-7-2': [
      ['You expected no help but an instructor assists you. Which is a belief update?', ['Pretend the help never happened','Revise your expectation about asking this instructor','Move to another machine without reconsidering anything'],1,'A belief update changes the interpretation or expectation in response to evidence.'],
      ['Which example changes the information you encounter through action?', ['Ask the instructor a question','Assume everyone is helpful without asking','Repeat the old expectation silently'],0,'Asking a question changes the situation and makes a response available to learn from.'],
      ['What can work together in this account?', ['Only changing beliefs, never acting','Only acting, never revising expectations','Revising expectations and taking a useful action'],2,'Perception and action offer complementary ways of responding to the situation.']
    ],
    'mind-7-3': [
      ['What does precision refer to in this framework?', ['How strongly you want something','How much confidence or weight an estimate receives','How quickly you finish a workout'],1,'Precision concerns confidence in information or predictions, rather than desire.'],
      ['Which evidence is clearer about an instructor\'s response to you?', ['A direct helpful answer to your question','An overheard fragment from another conversation','Your prediction before speaking'],0,'Direct relevant evidence is less ambiguous than an unrelated fragment.'],
      ['Two observations conflict. What should you consider?', ['Whichever arrived first must be correct','Whichever felt strongest is always true','How relevant and reliable each observation is'],2,'The weight given to evidence depends on its reliability and relevance, not just its emotional impact.']
    ],
    'mind-7-4': [
      ['Which benefit is pragmatic, meaning it meets a practical need?', ['Finding out where the gym entrance is','Getting movement during a suitable workout','Learning who can answer a question'],1,'An action has pragmatic value when it helps meet a need; it can also supply information.'],
      ['What is epistemic value?', ['The value of obtaining information','The number of calories burned','The guarantee of a pleasant outcome'],0,'An action can be valuable because it helps you learn.'],
      ['Can one action meet a practical need and provide information?', ['No, actions can serve only one purpose','Only if its outcome is certain','Yes, both benefits can occur together'],2,'A visit can meet a need for movement while also teaching you about the setting.']
    ],
    'mind-7-5': [
      ['After you act, what can inform the next expectation?', ['Only what you expected before acting','The evidence that comes back','Nothing, because expectations cannot change'],1,'An action changes what you encounter, supplying evidence that may inform later expectations.'],
      ['Which record helps inspect this loop?', ['What I expected, what I did, and what happened','Only whether I felt motivated','Only how other people performed'],0,'The record links an expectation, an action and the resulting evidence.'],
      ['How should the practical checklist be understood?', ['A literal conscious sequence behind every brain process','Proof that all first impressions are chosen','A way to examine part of a more complex process'],2,'The checklist is a practical aid; brain, body and environment interact across processes and timescales.']
    ],
    'mind-8-1': [
      ['Which statement is an inference about this moment?', ['Staff will always help in every gym','This instructor is being helpful today','My expectations have permanently changed'],1,'Inference estimates the current situation; learning concerns changes that can affect later estimates.'],
      ['What distinguishes a learned expectation?', ['It can influence how a later visit is interpreted','It must be a conscious slogan','It applies only to a sound noticed once'],0,'Learning can change relationships or parameters used to interpret future observations.'],
      ['In this lesson, what does calling the process an algorithm mean?', ['There is a tiny programmer in your head','Every brain update is identical in speed','It is a computational description of a process'],2,'The description is not literal software editing; biological learning involves neural processes across timescales.']
    ],
    'mind-8-2': [
      ['Why consider updating an expectation after contradictory evidence?', ['To erase every earlier experience','The old expectation explained this observation poorly','To make every future outcome certain'],1,'A revised expectation may better explain the evidence and support later decisions.'],
      ['Does noticing this mismatch guarantee lasting confidence?', ['No; how the evidence is interpreted and weighted matters','Yes; every surprise permanently changes a belief','No; evidence can never change expectations'],0,'A mismatch can guide an update without guaranteeing a lasting or immediate emotional change.'],
      ['What should you record about the helpful response?', ['Only that your original prediction was correct','Only your hoped-for feeling','The expectation and the response you actually received'],2,'Recording both makes the mismatch available to consider rather than rewriting the expectation afterwards.']
    ],
    'mind-8-3': [
      ['What helps determine how much an expectation changes?', ['The size of the mismatch alone','Confidence in the prior expectation and the new evidence','Whether you demand a large change'],1,'An update depends on the weighting of existing expectations and incoming evidence.'],
      ['Which observation offers stronger evidence about help at this gym?', ['Several clear, relevant helpful responses','An unclear comment heard from across the room','A prediction written before visiting'],0,'Clear relevant observations provide a stronger basis for updating than ambiguous information.'],
      ['What is a proportionate update after one useful conversation?', ['Everyone everywhere will always help','One helpful response erases my past','This conversation was helpful; I can test asking again'],2,'A specific update fits the evidence without extending it beyond what was observed.']
    ],
    'mind-8-4': [
      ['A helpful visit is dismissed as a one-off. What may happen?', ['The old expectation must disappear','The old expectation may remain largely unchanged','The visit supplied no information at all'],1,'Treating evidence as an exception can limit how much it revises a broader expectation.'],
      ['What could help you assess an apparent exception?', ['Further relevant experiences and a record of their outcomes','Repeating that you should feel different','Ignoring evidence that disagrees with the old belief'],0,'Additional relevant observations help test whether the result is an exception or a pattern.'],
      ['An expectation has not changed after one visit. What should you examine?', ['Whether the person is morally weak','Whether all learning is impossible','How clear, relevant and credible the new evidence seemed'],2,'How evidence is interpreted and weighted can affect whether it changes an existing model.']
    ],
    'mind-8-5': [
      ['When should you record the expectation for an experiment?', ['Only after seeing the result','Before the action or observation','Only when the result is positive'],1,'Recording it beforehand separates the original expectation from hindsight.'],
      ['After comparing expectation and outcome, what comes next?', ['Weigh the evidence and form a proportionate revised expectation','Assume the next visit is guaranteed to be easy','Discard any difficult result'],0,'The update should reflect the strength and relevance of the evidence.'],
      ['Why test the revised expectation again?', ['To force the same result every time','To prove the first experiment was perfect','To learn whether it holds in another relevant experience'],2,'Further testing supplies more evidence rather than treating one result as certainty.']
    ],
    'mind-1-2': [
      ['Which information does this framework bring together?', ['Only conscious thoughts','Past experience, sensory signals and body signals','Only information from other people'],1,'Learned expectations and current evidence work together to make sense of the situation.'],
      ['Does an initial interpretation have to stay the same?', ['No; further relevant evidence can change it','Yes; the first interpretation is always final','Yes; sensory evidence has no role'],0,'An initial interpretation can be revised as more evidence arrives.'],
      ['At an unfamiliar gym, what separates observation from interpretation?', ['Laughter proves judgement','Feeling watched proves hostile intent','Hearing laughter is an observation; assuming judgement is an interpretation'],2,'The signal does not arrive with a label specifying another person\'s intention.']
    ],
    'mind-1-3': [
      ['What is a prediction error?', ['A choice you regret','A mismatch between expectation and observation','Any unfamiliar place'],1,'The term describes a difference between what was predicted and what was observed.'],
      ['What influences whether a mismatch changes a lasting expectation?', ['How the evidence is interpreted and weighted','Only how dramatic it feels','Whether you can instantly choose confidence'],0,'Surprise alone does not determine a lasting learning update.'],
      ['Which expectation fits one helpful exchange?', ['No one will ever dismiss me again','All previous visits were actually pleasant','Asking this instructor a question can be useful'],2,'A specific revision stays close to the evidence from the exchange.'],
      ['You still feel nervous after receiving help. What can you conclude?', ['Learning is impossible','The helpful response is still evidence worth considering','The instructor cannot really have helped'],1,'Useful evidence does not require discomfort to disappear immediately.']
    ]
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
    const first=lessons['mind-1']?.find(l=>l.id==='mind-1-2');
    if(first){first.content.intro='Your brain sits inside your skull and receives signals from your senses and body. It has to infer what caused them. Predictive processing is a framework in which learned expectations and incoming evidence work together to build perception.\n\nAt an unfamiliar gym, laughter might initially feel like judgement because of earlier experiences. The signal is real; the interpretation can change as more evidence arrives. Prediction is not a picture of the whole universe, and expected sensations can still become conscious.\n\nAcross this course we will keep returning to this same example: what did you expect, what happened, and what changes next?';first.content.keyPoint='Your brain combines expectations and sensory evidence to infer what is happening.';first.games=lessons['mind-3'][0].games.map(g=>({...g}));if(facts)facts[first.id]=first.content.keyPoint;}
    const surprise=lessons['mind-1']?.find(l=>l.id==='mind-1-3');
    if(surprise){const detailed=lessons['mind-8'][1];surprise.content={...surprise.content,intro:'A prediction error is a mismatch between what was expected and what was observed. In predictive-processing models, it can guide updates in beliefs and learning.\n\nYou expected a dismissive answer at the gym, but received helpful advice. That is evidence worth considering. Whether it changes a longer-lasting expectation depends on how the evidence is interpreted and weighted, not just how surprising it felt.\n\nLater, What actually is learning? follows the update itself: what changes in the model, how much it changes and why one experience may be treated as an exception.',keyPoint:'Surprising evidence can guide learning; the update also depends on confidence and context.'};surprise.games=[{type:types.SCENARIO_STORY,scenario:'You expected a dismissive answer at the gym but received helpful advice.',question:'What does this mismatch give you?',options:['Evidence to consider when updating your expectation','Proof that every instructor will always help','A guarantee that your feeling changes immediately'],correctIndex:0,explanation:surprise.content.keyPoint},{type:types.SWIPE_TRUE_FALSE,question:'Every surprising experience automatically changes a long-lasting belief.',answer:false,explanation:surprise.content.keyPoint}];if(facts)facts[surprise.id]=surprise.content.keyPoint;}
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
