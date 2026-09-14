> Superseded for the public course: see [Six-week Learn restored](learn-six-weeks-restored-2026-09-14.md). Arunima retains her eight-week continuation.

# Eight-week Learn curriculum — 14 September 2026

Learn now owns 35 Mind and 10 Fuel lessons. Become retains the five identity lessons. All 40 Mind lessons therefore have a guided home for new and continuing Learn members. Lesson IDs and completion records are retained.

## Sequence

| Week | New starters | Existing Learn members |
|---|---|---|
| 1 | Why change feels hard | Original week 1 |
| 2 | Experience shapes reality | Original week 2 |
| 3 | The prediction-action loop | Original week 3 |
| 4 | Work with your energy | Original week 4 |
| 5 | What actually is learning? | Original week 5 |
| 6 | Make change repeatable | Original nutrition week 6 |
| 7 | Take the fight out of food | Experience and the prediction-action loop |
| 8 | Build your sustainable way forward | What actually is learning? |

New week 6 and continuation week 7 contain ten short lessons; other weeks contain five. Existing members already in Become keep the previous calendar. No member is moved backwards. The shared `learn-curriculum.js` module supplies browser and server week mapping, lesson ownership, action definitions and Learn/Become offsets.

Arunima Sharma has 25 completed lessons and is due to enter original week 6. Her continuation version is `bridge_eight_v1`. The database migration adds only this curriculum setting; her lesson list and other settings have identical before/after hashes. It does not credit unfinished actions, restart her enrollment or change her subscription.

## Teaching rationale and sources

Standing requirement reaffirmed by Shannon on 14 September 2026: every Learn week must include the existing practical weekly actions plus exactly one applied task from that week's course content. Retain the established five-step structure: meal tracking, movement, one lesson-linked experiment, one community action and the weekly check-in. The experiment must reference a lesson actually assigned to that member's week, with explicit evidence prompts; writing a plan alone must not mark the experiment completed.

Continuation week 7: track seven meals, complete three workouts/movement sessions, test one expectation in context, share one thing learned in Feed and complete the weekly check-in. Continuation week 8: retain meal/movement targets, test a prediction and record a proportionate model update, share course reflections and complete the check-in. Original weeks 1–6 and their evidence remain intact. The eight new-starter weeks and eight continuation weeks were audited against these requirements.

Use the same unfamiliar-gym example throughout: expect judgement, observe what happens, consider reliability, revise a proportionate expectation and test again. Explain state inference versus longer-lasting parameter learning, confidence/precision weighting, uncertainty, repeated evidence and generalisation. A numerical delta-rule example is explicitly a teaching sketch, not a literal complete neural algorithm.

The free-energy principle is presented as a theoretical framework. Statistical surprise, prediction error and variational free energy are distinguished. Free energy is not equated with calories, disagreement is not reduced to glucose conservation, and predictive processing is not used to claim a lack of agency or literal prediction of the entire universe.

- Friston (2010), [The free-energy principle: a unified brain theory?](https://www.nature.com/articles/nrn2787): framework, perception, action and learning.
- Smith, Friston and Whyte (2022), [A step-by-step tutorial on active inference](https://pmc.ncbi.nlm.nih.gov/articles/PMC8956124/): inference, parameter learning and epistemic value.
- Friston et al. (2015), [Active inference and epistemic value](https://www.fil.ion.ucl.ac.uk/~karl/Active%20inference%20and%20epistemic%20value.pdf): exploration can reduce uncertainty.
- Feldman and Friston (2010), [Attention, uncertainty, and free-energy](https://www.fil.ion.ucl.ac.uk/spm/doc/papers/Attention_uncertainty_and_free-energy.pdf): precision weighting.
- [The free-energy principle and the dark-room problem](https://pmc.ncbi.nlm.nih.gov/articles/PMC3347222/): avoiding the misleading claim that organisms merely seek no stimulation.
- [Interoceptive inference](https://pmc.ncbi.nlm.nih.gov/articles/PMC5062097/): bodily context and experience.

## Access and verification

Upfront Learn access is extended from 42 to 56 days at the existing price. Internal historical plan identifiers remain stable. Recurring billing amounts, six-payment minimums and cancellation terms are unchanged. There were no upfront purchase records to migrate. Public Learn descriptions and its curriculum list are aligned with eight weeks.

Verification covers 45 unique Learn lesson IDs, all 40 Mind ownerships, continuation progress, Learn/Become boundaries, action-specific evidence, nutrition at new week 8 versus continuation week 6, completed-record preservation, revision protection, weekly report saving and both dashboard loading paths.

Mobile QA uses a read-only local fixture of the actual dashboard course renderers and styles, with external writes blocked. It checks 320×568 and 390×844 portrait, 844×390 landscape, light/dark, opening, scrolling, returning and reopening. Safe-area values of zero, 32 and 59 pixels are injected into served CSS to simulate WebViews; this is browser simulation, not physical-device testing. Action close controls remain at least 60 pixels below the viewport top and bottom controls are reachable. Screenshots are retained in the task's work folder.
