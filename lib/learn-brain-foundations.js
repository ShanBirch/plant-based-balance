/* Beginner teaching around the existing Learn content. Completion IDs and the
 * shared player remain stable. See the teaching contract for scoped accuracy edits.
 */
(function(root, factory) {
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.BalanceBrainFoundations=api;
})(typeof window!=='undefined'?window:globalThis,function() {
  'use strict';
  const image=(file,label)=>({src:'assets/learning/'+file+'.svg',label,fit:'contain'});
  const brain=image('brain-body-messages','Brain, spinal cord and body: messages travel both ways');
  const neuron=image('neuron-messages','A neuron carries an electrical signal; chemical messengers cross a synapse');
  const senses=image('sensory-messages','Incoming routes: these signals meet the brain’s ongoing predictions');
  const loop=image('prediction-feedback-loop','Ongoing predictions, action and sensory feedback work together');
  const basics=[
    {
      id:'mind-0-5',title:'Your Brain Constructs Your Experience',image:brain,
      scenario:'Use the gym example to connect experience, thoughts and learning.',
      pages:[
        "Last lesson introduced the researchers. Now meet the central idea behind this course: your brain constructs your experience. What you see, touch and feel, including the thoughts that feel like decisions, involves your brain working with your body and surroundings.",
        "Your eyes don't send a finished picture into your head. Your body doesn't send a finished feeling labelled tired or confident. They provide signals. In the predictive account we are exploring, the brain uses ongoing expectations and sensory evidence to infer what those signals mean. Constructed doesn't mean imaginary: a real body and a real world constrain the experience.",
        "Imagine a difficult set in the gym. Each repetition becomes harder. Your muscles are fatiguing, and keeping the weight moving may require more drive from the nervous system. Signals from the body help regulate the activity. The brain's own movement-related activity also contributes to the experience of effort.",
        "A thought appears: I'm about to fail. Then another: I think I can do one more. It can feel as though your brain sent a warning and a separate you answered it. But both thoughts involve the brain working. Expectations, goals, attention, past experience and current bodily state all contribute.",
        "The thought about continuing is part of that process too. So is deciding to stop, checking your technique or remembering your coach's instructions. A conscious decision means a decision you experience consciously. It still happens within the brain's activity. It doesn't require a controller outside the predictive process.",
        "Agency means being able to influence your actions. Thinking things through, directing attention and learning are part of how your brain works. Learning can help change what you expect and how you respond next time. Your first thought doesn't have to determine your next action.",
        "You might learn to distinguish this feels difficult from I cannot complete another repetition with the intended technique. You might also learn when stopping is appropriate. The feeling of effort and your actual physical capacity are related, but they aren't identical. Understanding prediction doesn't make physical limits disappear.",
        "This is why learning about the brain matters. You can recognise familiar patterns, consider the evidence and practise different responses. Agency operates through the brain and body. Next, we will meet the brain itself and learn how its cells and communication pathways support this experience."
      ],
      keyPoint:'Your brain constructs your experience, including the thoughts that feel like decisions. Learning and agency operate through that process.',
      questions:[
        ['In this lesson, what does constructed experience mean?',['The outside world and your body are imaginary','The brain interprets signals using ongoing expectations and evidence','Your eyes send a finished picture directly into your thoughts'],1,'The experience is built through interpretation, constrained by a real body and world.'],
        ['During a hard set, you think I should stop and then I can continue. What connects these thoughts?',['Both involve your brain working with expectations, goals and bodily state','Only the stopping thought involves the brain','The second thought comes from a controller outside the brain'],0,'Both thoughts are part of the same brain-body process.'],
        ['Which account of effort fits the gym example?',['It is an exact announcement of how many repetitions remain','It is unrelated to the nervous system','It involves brain activity alongside regulation and signals from the body'],2,'Effort is an experience, not a perfect readout of physical capacity.'],
        ['What does conscious decision mean here?',['A decision that happens outside the brain','A decision you experience consciously within the brain’s activity','A thought that proves your prediction cannot change'],1,'Being aware of deciding does not require a separate controller outside the process.'],
        ['How can learning help your agency?',['By letting you leave the nervous system behind','By guaranteeing your first thought is always correct','By helping you recognise patterns and practise more informed responses'],2,'Learning, attention and considering evidence can influence your future expectations and actions.'],
        ['What contributes to the thoughts in the gym example?',['Past experience, current bodily state, goals and sensory evidence','Only a memory, with no current bodily information','Only the weight, with no expectations or context'],0,'The example connects what was learned before with current evidence, needs and goals.']
      ],
      checks:[['Understanding prediction makes physical muscle limits disappear.',false,'Feelings and physical capacity are related. Learning does not remove real bodily limits.'],['Learning and directing attention are part of how your brain works.',true,'Agency operates through the brain-body process; it does not require stepping outside it.']]
    },
    {
      id:'mind-0-1',title:'What Is Your Brain?',image:brain,
      pages:[
        "We have met the researchers and introduced how the brain constructs experience. Now let's meet the organ itself. Your brain sits inside your skull. It's living tissue made of connected cells, supplied with oxygen and nutrients by your blood.",
        "Your brain is part of your nervous system. This is the body's communication network. The brain, spinal cord and nerves exchange messages that help coordinate movement, sensations and bodily functions.",
        "The spinal cord runs down your back. Nerves connect this central network with the rest of your body. Messages travel both ways: information comes in from the body, and signals go out to muscles and other tissues. The brain is already active while these messages travel.",
        "Think about picking up a familiar cup. Before you lift it, your brain can already expect its position, usual weight and how the reach will feel. Those expectations help prepare the movement. Signals from your eyes, arm and hand provide evidence as you reach and lift, helping adjust what happens next.",
        "You don't have to consciously supervise every message. Breathing, balance and many other processes continue while you're thinking about something else. Some quick responses use spinal circuits rather than waiting for a conscious decision.",
        "For now, remember the network: brain, spinal cord and nerves. Next we'll zoom in to a cell that carries these messages. You don't need to memorise a map of brain regions to understand the course."
      ],
      keyPoint:'Your brain is living tissue within a communication network. Messages travel between the brain and body in both directions.',
      questions:[
        ['What is the brain?',['Living tissue made of connected cells','An electrical battery inside the skull','A muscle that moves the body directly'],0,'The brain is an organ made of living cells. Its signals coordinate activity; it does not physically pull your arm.'],
        ['What makes up the communication network introduced here?',['Only the brain','The brain, spinal cord and nerves','Only the muscles and bones'],1,'These parts of the nervous system exchange messages.'],
        ['You lift a cup and feel it touch your fingers. Which direction do those touch messages travel?',['Towards the brain through the nervous system','Only away from the brain','Directly from the cup to your thoughts'],0,'Touch provides incoming information while movement also involves outgoing signals.'],
        ['Why is the spinal cord included in the diagram?',['It stores food energy','It replaces every function of the brain','It links brain and body pathways and contains its own circuits'],2,'The spinal cord is part of the central nervous system, with pathways and circuits.'],
        ['While talking, you continue breathing. What does this show?',['Every bodily process needs a conscious instruction','Many processes continue without conscious supervision','The nervous system stops working during conversation'],1,'You do not consciously supervise every message.'],
        ['Which description of picking up a familiar cup fits the lesson?',['The brain must wait for every sensation before preparing any movement','Muscles decide everything without incoming information','Expectations help prepare the movement, while sensory feedback helps adjust it'],2,'The brain anticipates the reach and keeps using sensory evidence while the movement unfolds.']
      ],
      checks:[['Messages between the brain and body travel in both directions.',true,'Information comes in, and signals also go out.'],['Every quick response must wait for you to consciously decide.',false,'Some quick responses use spinal circuits, and many processes continue without conscious supervision.']]
    },
    {
      id:'mind-0-2',title:'How Brain Cells Send Messages',image:neuron,
      pages:[
        "We've met the brain and its communication network. Now meet a neuron: a nerve cell specialised for sending and receiving signals. Other cells support neurons, so the brain isn't made of neurons alone.",
        "A neuron has branches that receive signals, a cell body and a long extension called an axon. Signals arriving at the cell influence whether it sends an electrical pulse along that axon.",
        "That pulse is called an action potential. It's a rapid change in electrical charge across the cell membrane, produced by the movement of charged particles called ions. It isn't household electricity travelling through a wire.",
        "At many connections, the electrical pulse reaches the end of the axon and triggers the release of chemical messengers. These are neurotransmitters. They cross a tiny gap called a synapse and act on the next cell.",
        "The next cell receives the chemical message. Some messages make another pulse more likely; others make it less likely. These inputs come from other cells throughout the network, not just from the senses. Networks are already active rather than waiting silently for an outside message.",
        "Return to the cup: movement and touch depend on signals travelling through connected cells. Electrical activity within a neuron and chemical communication at many synapses let the network pass information along."
      ],
      keyPoint:'Neurons carry electrical signals along their axons and use chemical messengers at many synapses to influence the next cell.',
      questions:[
        ['What is a neuron?',['A bone protecting the brain','A nerve cell that sends and receives signals','A chemical stored in a muscle'],1,'A neuron is a specialised cell, not the chemical message itself.'],
        ['Which part carries the electrical pulse along a neuron?',['The axon','The skull','The gap between cells'],0,'The axon is the long extension along which an action potential travels.'],
        ['What is an action potential?',['A conscious decision to exercise','A movement of the entire brain','A rapid electrical change across a neuron membrane'],2,'Charged particles moving across the membrane produce the electrical change.'],
        ['At many synapses, what carries the message across the gap?',['The axon itself moving across','Chemical messengers called neurotransmitters','A complete picture from the eyes'],1,'Neurotransmitters cross the gap and act on the next cell.'],
        ['What can an incoming message do to the next neuron?',['Make firing more or less likely','Always force it to fire','Give it a permanent new identity'],0,'Different inputs can increase or decrease the likelihood of another electrical pulse.'],
        ['Which order fits the connection described?',['Chemical message, cup moves, neuron forms','Two cells fuse, then a wire carries electricity','Electrical pulse reaches axon ending, chemical message crosses gap, next cell responds'],2,'The diagram follows the electrical signal within a neuron and the chemical message at a synapse.']
      ],
      checks:[['A neurotransmitter is a chemical messenger.',true,'It communicates across many synapses.'],['The brain sends messages using household electricity flowing through wires.',false,'Neural electrical activity comes from charged particles moving across cell membranes.']]
    },
    {
      id:'mind-0-3',title:'How Your Brain and Body Work Together',image:brain,
      pages:[
        "Now we know how neurons pass messages. What are those messages doing? Some bring information towards the central nervous system. Others carry signals towards muscles and other tissues. These exchanges happen within an already active system that keeps anticipating what is happening and what comes next.",
        "A sensory signal carries information, such as touch or limb position. A motor signal helps organise movement. Motor means movement here. Both matter when you reach for the cup.",
        "Before and during the reach, the brain anticipates how your arm will move and what the cup will feel like. Signals travelling through the nervous system help coordinate the movement. Muscles contract, pulling on bones through tendons. The brain doesn't physically move the arm by itself.",
        "At the same time, information about arm position and the cup touching your hand travels back. This is sensory feedback. It is compared with what was expected. If the cup is lighter than expected, that difference can help adjust the grip and reach, often without a conscious decision.",
        "Other pathways help regulate internal activity, including heart rate and digestion. Hormones, which are chemical messengers carried in blood, also help coordinate the body. Nerve signals and hormones aren't the same thing.",
        "Notice the ongoing loop: anticipate, act and check sensory feedback. These processes overlap; the brain doesn't wait for all the information before starting to predict. Later, active inference will explain movement in terms of predictions about bodily sensations, with muscles and reflex pathways helping bring those sensations about."
      ],
      keyPoint:'Ongoing expectations help prepare movement. Signals to the body and sensory feedback work together to guide and adjust it.',
      questions:[
        ['In this lesson, what does motor mean?',['Movement','Memory','Mood'],0,'Motor signals help organise movement.'],
        ['What physically moves the bones as you lift a cup?',['Your thoughts pulling on the cup','Muscles contracting and pulling through tendons','The skull changing shape'],1,'Signals coordinate muscles, and the muscles produce the movement.'],
        ['Why does information about arm position return?',['To replace the outgoing signal entirely','To stop all movement','To help adjust the ongoing movement'],2,'Feedback helps coordinate the grip and reach.'],
        ['What is a sensory signal?',['Information such as touch or position coming towards the nervous system','A hormone carried in blood','A conscious instruction to lift more weight'],0,'Sensory signals provide incoming information.'],
        ['Which statement distinguishes hormones from nerve signals?',['Hormones are thoughts','Hormones are chemical messengers carried in blood','Both are identical wires'],1,'The body uses more than one communication system.'],
        ['Which account best describes the reach?',['The brain sends one command and gets no further information','The brain only starts predicting once the lift is finished','Predictions help guide the reach while sensory feedback helps adjust it'],2,'Anticipation, movement and sensory feedback work together continuously.']
      ],
      checks:[['Feedback means information returning about what happened.',true,'Position and touch signals help adjust the action.'],['The brain physically pulls your bones to move your arm.',false,'Muscles contract and pull on bones; nervous-system signals coordinate them.']]
    },
    {
      id:'mind-0-4',title:'How Information Reaches Your Brain',image:senses,
      pages:[
        "We have followed the messages between brain and body. Your brain is already making predictions as your senses convert light, sound, touch, taste and smell into signals. The diagram shows the incoming routes. It doesn't show the whole prediction-and-feedback process.",
        "When you look at a cup, light reaching your eyes is converted into neural activity. Your eyes don't send a tiny photograph into your skull. The brain uses ongoing predictions and these signals to infer what caused them. Infer means work out the most likely explanation. The cup you experience is built through that process.",
        "Information also comes from inside your body, such as signals related to breathing, the heartbeat and the gut. Interoception is the name for sensing and interpreting the body's internal state.",
        "Another source is information about your muscles and joints. It helps you sense where your arm is, even without looking. This is called proprioception. You only need the meaning: sensing body position and movement.",
        "Return to the familiar cup. Your brain anticipates its shape, weight and how your arm will move. Incoming signals are compared with those expectations as the action unfolds. You can still consciously see and feel the cup when it is just as expected. A mismatch is not required for every conscious experience.",
        "A prediction is an expectation about what is happening or what comes next. A prediction error is a difference between an expectation and incoming signals. The brain weighs expectations and sensory evidence according to how reliable they seem. A difference can lead to a revised explanation or an adjustment in action, often without you noticing."
      ],
      keyPoint:'Your brain infers what is happening through ongoing predictions and sensory evidence. It receives signals, not direct access to the world or a finished picture of it.',
      questions:[
        ['What do your eyes send towards the brain?',['A complete miniature photograph','Neural signals produced in response to light','Only words describing the scene'],1,'Light is converted into neural activity, not a photograph inside the skull.'],
        ['What is interoception?',['Sensing and interpreting internal bodily state','Seeing distant objects','Choosing your workout calendar'],0,'Internal signals include information related to the heartbeat, breathing and gut.'],
        ['What does proprioception help you sense?',['Other people’s opinions','Only colour and brightness','Your body position and movement'],2,'Muscle and joint information helps you know where your arm is.'],
        ['Which sources provide information while lifting the cup?',['Only sight','Sight, touch and body-position signals','Only memories from yesterday'],1,'These sensory signals are compared with ongoing expectations; they do not arrive as a finished explanation.'],
        ['How does the brain work out what is happening?',['It waits for a complete picture from the eyes before making any predictions','It uses ongoing predictions and sensory evidence to infer likely causes','It has direct access to the world and never needs to check its expectations'],1,'The brain builds its best explanation from predictions and sensory evidence. It can anticipate the cup’s weight before lifting it.'],
        ['The familiar cup is unexpectedly empty. What makes this useful for the next lesson?',['The expected weight and felt weight differ','Your senses have stopped working','There can be no information from an empty cup'],0,'This mismatch introduces the prediction-and-feedback idea using the same cup.']
      ],
      checks:[['Incoming information includes signals from inside the body.',true,'The course uses both internal and external signals.'],['You can only consciously feel the cup when its weight differs from your prediction.',false,'Expected sensations can be conscious too, and some prediction errors are handled without conscious awareness.']]
    }
  ];
  // Each row provides meaning before terminology, one connected example, and a
  // small observation afterwards. The original lesson follows between the two.
  const bridges={
    'mind-1-2':[
      'A prediction is an expectation about what is happening or what comes next, not a conscious decision or a wish. Sensory signals are incoming information from your senses and body. Ongoing predictions anticipate those signals and help infer what is causing them.',
      'Keep the familiar cup in mind. You prepare to lift its usual weight. If it is empty, the lightness differs from what you expected. The expectation and the incoming information work together.',
      'Notice one familiar action today. What did you expect to see or feel? What actually happened? You are looking for expectation and feedback, not trying to control every thought.'
    ],
    'mind-1-3':[
      'Last lesson connected an expectation with incoming information. Prediction error names the mismatch between them. Error here means a difference, not a mistake you should feel guilty about.',
      'You lift the cup expecting it to be full, but it is empty. That difference gives the brain information it did not expect. Internal model means the learned picture the brain uses to make its next guess.',
      'Before one small task, write what you expect. Afterwards, write what happened and whether it changes your next expectation. That is the model-update idea in ordinary words.'
    ],
    'mind-1-4':[
      'We have followed expectation, information and a mismatch. Now ask where the expectation came from. Past experience is the information your brain has learned from, including experiences you do not deliberately recall.',
      'Someone who repeatedly found gyms welcoming and someone who felt embarrassed at school sport can walk through the same gym door expecting different things. Their earlier experiences supply different starting guesses.',
      'Choose one expectation about exercise. Which earlier experience helps explain it? Describe the connection without treating that expectation as your permanent future.'
    ],
    'mind-1-5':[
      'Bayesian means combining what was expected before with new evidence. A prior is that starting expectation. Evidence is the information you receive. The updated expectation is what you carry forward.',
      'If you have struggled with workouts for years, one comfortable walk gives new evidence. It matters, but it sits alongside a longer history. More manageable walks supply more experiences to learn from.',
      'Write your starting belief, one experience that adds evidence, and what you expect next time. You do not need to calculate a probability to use the idea.'
    ],
    'mind-3-1':[
      'A concept is a learned way of grouping and giving meaning to things. Exercise is a concept: the word can bring to mind a walk, a sports class, a difficult gym session or something else from your history.',
      'Return to the gym doorway. One person connects gym with support; another connects it with being judged. The same place activates different learned meanings.',
      'Finish the sentence: when I think of exercise, I expect ____. Then choose one manageable experience that could add a different piece of evidence.'
    ],
    'mind-3-2':[
      'A category groups experiences under a name, such as excitement or anxiety. Context means what is happening around you. The lesson connects body signals, learned categories and context.',
      'At the gym door your heart is racing. Before a lift, that sensation has a different context from being worried that someone will judge you. The bodily signal alone does not explain the whole experience.',
      'Recall one racing-heart moment. Describe the bodily sensation and situation separately before naming the emotion. This is an observation, not a rule that you must relabel a feeling.'
    ],
    'mind-3-3':[
      'Earlier we connected history with expectations. Here we apply that connection to starting again. Evidence means an experience you can learn from, including a manageable attempt that actually happened.',
      'If past plans felt overwhelming, the next gym visit can start with an expectation of failure. A short session you can complete supplies a different experience to compare with that expectation.',
      'Record what you expected before a small session and how the real session went. Keep both the easy and difficult parts in the evidence.'
    ],
    'mind-3-4':[
      'Context includes the place, people, timing and circumstances around an action. It can also include your current bodily state. We are adding these details to the expectation-and-feedback loop.',
      'Compare the same gym session in a quiet hour with a supportive friend and in a crowded hour when you feel watched. The exercise can be similar while the surrounding experience differs.',
      'Keep one activity familiar and adjust one contextual detail, such as timing or company. Notice whether the experience changes, then record it.'
    ],
    'mind-3-5':[
      'We have connected concepts, emotion, history and context. Reshaping experience means giving the brain new experiences to learn from. Neuroplasticity refers to changes in the nervous system with experience.',
      'A manageable gym visit supplies actual evidence about this gym, this session and what you can do now. Several ordinary visits build a history beyond the old school-sport experience.',
      'Try one manageable version of the activity and report the outcome in your weekly check-in. An experience that went differently from the plan still gives useful information.'
    ],
    'mind-2-1':[
      'The brain helps regulate bodily needs. Homeostasis means keeping internal conditions within workable ranges. Allostasis means preparing and adjusting for demands. These are the two terms this lesson compares.',
      'Before a planned workout, the body can prepare for activity. Anticipating demand connects the predictive-brain idea with bodily regulation, rather than leaving prediction as only something you see or think.',
      'Notice what happens before familiar activity, such as arriving for a session. Describe the situation and your sensations without needing to measure a hormone.'
    ],
    'mind-2-2':[
      'Body budget is an everyday comparison for managing bodily resources. It is not a bank balance you can read from one feeling. Sleep, nourishment, activity and stress provide the practical context.',
      'Imagine a workday after poor sleep and a missed lunch. The evening workout belongs to that whole day. Planning it as though you were rested and well fed leaves out important information.',
      'Before your next session, note sleep, meals, energy and the demands of your day. Use those details with your coach to choose a manageable plan.'
    ],
    'mind-2-3':[
      'Internal signals tell the nervous system about bodily activity. A feeling is your experienced interpretation, such as hunger or tiredness. The lesson connects those signals with learned expectations.',
      'At your usual lunchtime, time, routine and current body signals are all part of the situation. Asking about those influences does not mean hunger is fake or that you should ignore it.',
      'Notice one feeling alongside sleep, food and context. If you are hungry, eating is appropriate; observation is not a food-restriction exercise.'
    ],
    'mind-2-4':[
      'Fatigue means the experience of tiredness or reduced capacity. A fuel gauge is a direct reading of a tank; fatigue is not that kind of simple reading. This lesson examines the brain’s anticipatory role.',
      'After a long workday, the expected effort of a workout enters a situation already shaped by sleep, meals and activity. Feeling tired is real information to consider, not a character test.',
      'Describe tiredness and the day around it at check-in. A shorter session or recovery may fit. Understanding prediction does not require pushing through pain or exhaustion.'
    ],
    'mind-2-5':[
      'Stress involves preparing for demands. Cortisol is a hormone involved in that regulation. Chronic means ongoing over time. We are connecting anticipation with a bodily response.',
      'Thinking about tomorrow’s demanding workday can affect tonight’s experience. The upcoming demand is expected, even though you are currently sitting at home.',
      'Name one expected demand and one practical preparation, such as arranging tomorrow’s meal or a realistic session time. Notice whether that preparation helps.'
    ],
    'mind-7-1':[
      'You already know expectation, incoming signals and mismatch. The free-energy principle connects these ideas in a mathematical framework. Free energy here is not calories or how energetic you feel.',
      'Use the cup again. You expect its familiar weight but receive a lighter sensation. Prediction error describes that mismatch. Technical surprise concerns how unexpected information is under a model; it is not simply feeling startled.',
      'Explain the cup example in your own words before memorising the theory’s name. Keep prediction error, technical surprise and physical energy as distinct ideas.'
    ],
    'mind-7-2':[
      'Perception is making sense of information. Action changes what you do and the information you receive. Active inference connects interpreting and acting, including actions that help you learn.',
      'The cup feels lighter than expected. You can interpret it as empty, or look inside to gather more information. Refilling it also changes the situation. Thinking differently and acting are connected routes.',
      'For one everyday mismatch, describe what you could learn and what action could change the situation. Use a real example rather than only repeating the terms.'
    ],
    'mind-7-3':[
      'Precision means how reliable information or an expectation is treated in this framework. Think confidence or weighting, rather than being very neat. Weighting means giving some information more influence.',
      'In dim light the cup looks full, but lifting it feels unexpectedly light. A clearer look inside supplies better information. The brain has different sources to weigh when interpreting the cup.',
      'Ask which evidence you are relying on and how clear it is. One difficult workout and a month of recorded sessions offer different amounts of information.'
    ],
    'mind-7-4':[
      'We introduced bodily resources earlier. This lesson brings regulation into the perception-and-action loop. Metabolic refers to the processes that supply and use energy in the body.',
      'On a poorly slept, busy day, the same gym plan is being considered in a different bodily context. Rest, food and a changed session plan are actions within that context.',
      'Record the day’s demands with the workout outcome. Look at the complete situation when choosing the next adjustment.'
    ],
    'mind-7-5':[
      'A system is a set of interacting parts. Here the parts include your body, actions and surroundings. A feedback loop means each action changes information that can affect the next action.',
      'Leaving the gym bag where you will see it changes what is around you. Seeing it can cue a session; doing that session gives more experience. The person and setting keep influencing each other.',
      'Change one part of your surroundings and notice the effect on one action. Describe the cue, what you did and what happened next.'
    ],
    'mind-4-1':[
      'A habit is an action that becomes easier to start in a familiar situation through practice. Automatic means less deliberate attention is needed, not that the body no longer uses signals.',
      'Putting walking shoes on after breakfast can begin as a deliberate choice. Practising that same sequence makes the breakfast-and-shoes situation increasingly familiar.',
      'Choose one cue and one small action to practise together. Record whether the cue actually helped you begin.'
    ],
    'mind-4-2':[
      'Consistency means returning to a pattern repeatedly. Frequency is how often you practise. Intensity is how demanding the effort is. This lesson compares repeated experience with occasional big efforts.',
      'The breakfast-and-shoes routine can happen in a small version on a busy day. Each actual attempt supplies another experience of starting the walk.',
      'Choose a repeatable pattern that includes recovery. Track attempts and the experience, rather than making every day a maximum-effort test.'
    ],
    'mind-4-3':[
      'Minimum viable action means the smallest useful version of an action that fits the situation. It keeps the practice achievable. It does not mean that every training goal needs only that amount forever.',
      'If the planned walk will not fit today, a brief walk after breakfast keeps a version of the same routine. It supplies experience of beginning, even on a busy morning.',
      'Write your usual action and a smaller version for a busy day. Try the version that fits and record what you did.'
    ],
    'mind-4-4':[
      'An environmental cue is something around you that can prompt a familiar routine. A trigger is the event or signal that helps start it. We are connecting the setting with practice.',
      'Shoes by the breakfast table make the walk easier to remember. Shoes hidden in a cupboard and a phone in your hand create a different starting situation.',
      'Put one useful cue where it belongs in your routine. Test whether it helped, rather than assuming a visible object guarantees the action.'
    ],
    'mind-4-5':[
      'A streak records consecutive occasions when an action happened. Repeated records show a pattern. Recovery and a return after interruption still belong in a sustainable routine.',
      'Several breakfast walks create familiar experience. If a morning is missed, the earlier walks still happened. The useful next question is how to return to the pattern.',
      'Record the next planned opportunity to return. Rest days can be part of the plan; a streak is not an instruction to train through exhaustion.'
    ],
    'mind-8-1':[
      'Learning changes what you know or can do through experience. Metabolic energy is physical energy used by living tissue. It is different from the mathematical free energy introduced earlier.',
      'Learning a new gym movement asks you to attend to unfamiliar instructions and feedback. Start with a manageable attempt rather than changing the whole routine at once.',
      'Note what was unfamiliar, what feedback you received and what became clearer. Feeling mentally tired alone does not tell you how much energy a particular model update used.'
    ],
    'mind-8-2':[
      'Confirmation bias means favouring information that fits an existing belief. Disconfirming evidence is information that challenges it. The lesson connects these with the model you already expect.',
      'After a session, someone expecting to fail may dwell on one difficult exercise and overlook several completed ones. Recording the whole session makes more evidence available.',
      'Write one thing that matched your expectation and one that challenged it. Include both when reviewing what happened.'
    ],
    'mind-8-3':[
      'Perception is what you experience; attention is what receives focus. A self-fulfilling loop connects an expectation, what you notice, what you do and the outcome that follows.',
      'Expecting the gym to be miserable can direct attention towards discomfort. Only recording the hardest moment leaves the easy moments out of the account.',
      'Record the whole attempt: difficult parts, manageable parts and what you actually completed. Compare that account with your starting expectation.'
    ],
    'mind-8-4':[
      'Model updating means changing a learned expectation in response to information. Reinterpret means giving information a different meaning. This lesson examines ways people hold on to existing expectations.',
      'Someone who expects every workout to be overwhelming may dismiss a comfortable short session as not counting. That dismissal removes useful new experience from their judgement.',
      'Ask whether you are excluding an actual attempt because it was smaller than expected. Record the attempt before deciding what it means.'
    ],
    'mind-8-5':[
      'We have connected learning, attention and resistance to new information. Making learning manageable means choosing a small enough change that you can try it and notice the result.',
      'Try one short session at a quieter gym time rather than replacing every meal, workout and bedtime together. A specific change gives you a clearer experience to review.',
      'Choose one change, write an expectation, try it, record the outcome and decide what to repeat or adjust. Keep your update connected to the evidence.'
    ],
    'fuel-6-1':[
      'A craving is a strong desire for a particular food or experience. Hunger is a bodily need for food. Habit, availability, emotion and hunger can overlap, so they are worth noticing separately.',
      'After dinner you sit on the sofa and turn on the TV. If snacks have often accompanied that sequence, the situation can bring them to mind. You may also still be hungry.',
      'Describe the meal, hunger, situation and craving. Eating when hungry is appropriate. The experiment is understanding the sequence, not proving you can avoid food.'
    ],
    'fuel-6-2':[
      'The body-budget idea brings sleep, nourishment and demands into the food situation. Those details help you understand what came before a craving rather than judging it in isolation.',
      'Keep the evening sofa situation. A satisfying dinner after decent sleep is a different starting point from a missed lunch and an exhausting day. The visible snack is only one part of the picture.',
      'Record meals, sleep and demands with the craving. Do not conclude that a recent meal makes hunger impossible; describe what you actually feel.'
    ],
    'fuel-6-3':[
      'Comfort food is food associated with a comforting experience. Short-term means the immediate period afterwards. The lesson compares that immediate effect with the need that may still remain.',
      'A familiar snack on the sofa may briefly feel comforting after a lonely evening. Eating can be enjoyable, while loneliness may still call for connection as well.',
      'Notice what the snack did for you and what needs remain. Nourishment and another kind of support can both belong in the same evening.'
    ],
    'fuel-6-4':[
      'Emotional granularity means describing feelings more specifically. Instead of only bad, you might identify lonely, worried or overwhelmed. A clearer description helps you consider a fitting response.',
      'Return to the sofa. If you are lonely, connection may help; if hungry, food fits; if exhausted, recovery matters. More than one can be present.',
      'Name the feeling, bodily need and context as clearly as you can. Then try one response that fits, without making food a reward or punishment.'
    ],
    'fuel-6-5':[
      'We have followed the same evening through routine, nourishment, comfort and feelings. Addressing the need means responding to that actual context rather than fighting the craving alone.',
      'If skipped meals left you hungry on the sofa, plan a more satisfying meal and eat enough. If loneliness also matters, arrange contact with someone. Adjust the situation you observed.',
      'For your weekly experiment, record the pattern, one relevant adjustment and what happened. A neutral outcome is useful evidence for the next adjustment.'
    ],
    'mind-6-1':[
      'Willpower is the everyday word for trying to resist or persist. A competing prediction means another expected action or outcome pulling attention in a different direction. This lesson examines the context behind that struggle.',
      'After dinner the sofa, TV and visible snacks make a familiar sequence easy to begin. Changing the setup creates a different choice situation instead of asking for more effort in the same setting.',
      'Choose one practical change to the situation you actually struggle with. Keep enough food available for hunger; environment design is not a rule to suppress eating.'
    ],
    'mind-6-2':[
      'Behaviour means what you do. We now connect learned expectations, bodily state and surroundings with actions. The prediction-action loop is the course’s way of explaining that connection.',
      'The evening sequence supplies cues: dinner ends, TV starts, snacks come into view. Asking what each step leads you to expect helps explain the familiar action.',
      'Write the steps of one real routine. Identify one point you can change, then observe the following action.'
    ],
    'mind-6-3':[
      'Inherited here means learned from the environment you grew up in, not only inherited through genes. Repeated family and social routines can become familiar starting expectations.',
      'If evenings usually meant TV and snacks in your childhood home, that sequence may remain familiar later. It helps explain a pattern without making it a permanent rule.',
      'Name one learned routine and one part you want to practise differently now. Start with a small change you can observe.'
    ],
    'mind-6-4':[
      'Redesigning the system means changing how an action is set up: cues, access, timing or sequence. Friction means the effort or inconvenience involved in doing it.',
      'If you want a walk after dinner, accessible shoes and a clear time reduce the steps needed to start. This adjusts the same evening routine rather than relying on a new personality.',
      'Make one useful action easier to start. Record the setup, whether you did it and what still got in the way.'
    ],
    'mind-6-5':[
      'A social environment is the people and shared activity around you. Association means two things were observed together; it does not by itself establish that one caused the other. Relative increase is a comparison with a starting risk, not a guarantee.',
      'A friend who joins your after-dinner walk changes the actual evening experience. Seeing and participating in ordinary routines supplies something more concrete than simply intending to change.',
      'The Feed example below shows one way to observe social interaction. You can consider what might change without posting or submitting a course task.'
    ],
    'fuel-1-2':[
      'A calorie is a unit of physical energy. Energy balance compares energy consumed with energy used over time. It is different from mathematical free energy in the brain theory.',
      'A plant-based dinner supplies energy for life, activity and recovery. The portion, the rest of your meals and activity form a pattern across time; one dinner is not a moral score.',
      'Notice how your meal supports hunger, satisfaction and activity. Discuss the longer-term pattern with your coach rather than judging one food or one scale reading.'
    ],
    'fuel-2-2':[
      'Protein is a nutrient made of building blocks called amino acids. Your body uses them for tissue maintenance and repair. Muscle is living tissue, and training and recovery belong alongside food.',
      'For a plant-based dinner, tofu, lentils or beans can provide protein alongside other foods. The point is a meal that supplies useful nutrients and enough food for your needs.',
      'Identify a protein food in a familiar meal. Bring that meal to your coach if you need help adjusting portions or variety.'
    ],
    'fuel-2-3':[
      'Carbohydrates are a source of physical energy. Glucose is a sugar the body can use as fuel. Glycogen is stored carbohydrate. Fibre is another component found in many carbohydrate-containing foods.',
      'Rice, potatoes, oats, fruit and legumes can fit alongside protein and vegetables. Choose meals that support your actual day rather than removing a whole group because of its name.',
      'Notice a familiar carbohydrate food and how the meal fits hunger and training. Keep the food example connected to your own routine.'
    ],
    'fuel-2-4':[
      'Dietary fat is a nutrient with roles in energy supply, cell structures and absorption of some vitamins. Essential means the body needs it. Foods can contain more than one nutrient.',
      'Olive oil, nuts, seeds and avocado can contribute fat to a plant-based meal. The amount and the overall meal still matter; needed does not mean unlimited.',
      'Identify one source of fat in a meal you enjoy. Look at the whole meal with your coach rather than treating one nutrient as good or bad.'
    ],
    'fuel-5-5':[
      'Sustainable means workable enough to continue in your life. Flexible means the pattern can adapt to circumstances. We now bring nourishment, habits, context and feedback together.',
      'Choose a familiar plant-based meal with a protein food, carbohydrate food, vegetables and a source of fat. Make it fit your appetite, preferences, time and available ingredients.',
      'Try the meal, record what worked and choose one adjustment. Finish the course with a plan for ordinary days, busy days and returning after an interruption.'
    ]
  };
  function apply(lessons, types, units, facts) {
    units['mind-0']={id:'mind-0',moduleId:'mind',title:'Meet Your Brain',description:'Brain cells, messages and the brain-body connection',order:0};
    lessons['mind-0']=basics.map((row,i)=>({id:row.id,unitId:'mind-0',order:i+1,title:row.title,
      content:{intro:row.pages.join('\n\n'),keyPoint:row.keyPoint,image:row.image},
      games:[...row.questions.map(([question,options,correctIndex,explanation])=>({type:types.SCENARIO_STORY,scenario:row.scenario || 'Use the cup example and the communication diagram.',question,options,correctIndex,explanation})),
        ...row.checks.map(([question,answer,explanation])=>({type:types.SWIPE_TRUE_FALSE,question,answer,explanation}))]
    }));
    if(facts) for(const row of basics) facts[row.id]=row.keyPoint;
  }
  function support(lesson) {
    const row=bridges[lesson.id];
    if(!row) return {before:[],after:[]};
    // Assigned nutrition already has its own connected family-meal examples.
    if(lesson.personalised) return {before:[{text:row[0],image:lesson.content.image}],after:[]};
    const visual=/^mind-1-|^mind-7-/.test(lesson.id)?loop:lesson.content.image;
    return {before:row.slice(0,2).map(text=>({text,image:visual})),after:[{text:'Optional example: '+row[2],image:visual}]};
  }
  const catalog=basics.map(row=>({id:row.id,title:row.title,unit:'mind-0',topic:'Meet Your Brain',course:'learn',week:1,required:true}));
  return {apply,support,catalog,basics,bridges};
});
