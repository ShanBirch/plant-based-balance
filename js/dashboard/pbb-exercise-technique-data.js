(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.PBBExerciseTechnique = api;
})(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    const RESET = 'Between sets: choose one cue for the next set. Reduce the load or stop if you feel sharp pain, numbness, dizziness, or form you cannot control.';

    const TEMPLATES = {
        non_exercise: {
            family: 'Not an exercise',
            force: 'No technique panel is shown for rest or catalogue placeholder rows.',
            setup: ['Rest.', 'Recover.', 'Prepare for the next exercise.'],
            move: ['Rest.', 'Recover.', 'Prepare for the next exercise.'],
            hidePanel: true
        },
        recovery: {
            family: 'Recovery work',
            force: 'Recovery work should create tolerable pressure or an easy stretch, not force a joint past the range you can control.',
            setup: ['Support your body so the target area can relax.', 'Start with light pressure and slow breathing.', 'Keep the nearest joint in a comfortable, neutral position.'],
            move: ['Move slowly over the target tissue or into the stretch.', 'Pause on useful tension, not sharp or electrical pain.', 'Come out gradually and reassess before going deeper.']
        },
        mobility: {
            family: 'Mobility and control',
            force: 'Breath, support points, and active muscle tension guide the joint through range without hanging on passive structures.',
            setup: ['Find length through the spine before chasing range.', 'Ground the support points and breathe into the rib cage.', 'Set the joint in a position that feels open rather than pinched.'],
            move: ['Move slowly and keep the range smooth.', 'Pause before tension becomes a joint pinch.', 'Exit with the same control used to enter.']
        },
        balance: {
            family: 'Balance and control',
            force: 'The foot or hand reads the surface while the ankle, hip, core, and eyes coordinate to keep your centre of mass controlled.',
            setup: ['Fix your eyes on a steady point.', 'Build a firm tripod through the supporting foot or hand.', 'Stack ribs over pelvis before reducing support.'],
            move: ['Make small corrections instead of stiffening everything.', 'Keep the supporting knee tracking with the toes.', 'Use a wall or bench before balance loss changes the exercise.']
        },
        power: {
            family: 'Power and landing',
            force: 'Power starts by loading the ground, then transferring force quickly through ankles, knees, hips, trunk, and arms.',
            setup: ['Load with the whole foot and knees tracking over toes.', 'Brace before the explosive phase.', 'Create enough space to land or receive the implement safely.'],
            move: ['Accelerate with intent, then land or catch quietly.', 'Absorb force through hips, knees, and ankles together.', 'Reset your position before the next repetition.']
        },
        carry: {
            family: 'Loaded carry',
            force: 'The load pulls you away from alignment while the grip, shoulder, trunk, hips, and feet work together to keep you stacked.',
            setup: ['Stand tall with ribs over pelvis.', 'Set the loaded shoulder wide and away from the ear.', 'Grip firmly and choose a load that does not tilt the torso.'],
            move: ['Take quiet, even steps.', 'Keep the load close and the pelvis level.', 'Breathe behind the brace instead of holding your breath.']
        },
        core_rotation: {
            family: 'Rotation and anti-rotation',
            force: 'The hips and rib cage create or resist rotation while the trunk transfers force without twisting through one vulnerable segment.',
            setup: ['Stack ribs over pelvis and brace around the whole waist.', 'Ground the feet, knee, or hip before moving the arms.', 'Keep shoulders away from ears.'],
            move: ['Rotate through the intended hips and upper back, or resist rotation completely.', 'Keep the pelvis controlled unless the exercise asks it to turn.', 'Return slowly without the cable, band, or momentum pulling you back.']
        },
        core_bracing: {
            family: 'Core bracing',
            force: 'The trunk resists unwanted extension or flexion so force from the arms and legs can pass through a stable spine.',
            setup: ['Stack ribs over pelvis and create 360-degree pressure around the waist.', 'Keep the neck long and jaw relaxed.', 'Choose a lever length that lets the low back stay controlled.'],
            move: ['Move the arms or legs without losing trunk position.', 'Exhale through effort while maintaining the brace.', 'Shorten the range when momentum or low-back movement takes over.']
        },
        neck: {
            family: 'Neck control',
            force: 'Small neck muscles guide the head while the rib cage and shoulder blades provide a quiet base.',
            setup: ['Sit or lie tall through the crown of the head.', 'Keep shoulders relaxed and jaw unclenched.', 'Begin with a small pain-free range.'],
            move: ['Move slowly without jutting the chin.', 'Keep the motion centred rather than tipping or twisting away.', 'Stop before strain spreads into the shoulders or arms.']
        },
        hinge: {
            family: 'Hip hinge',
            force: 'The floor pushes back through the feet while the posterior chain extends the hips and the trunk transfers force without bending under load.',
            setup: ['Root the whole foot and soften the knees.', 'Brace ribs to pelvis, then push the hips back.', 'Keep the load close and the neck in line with the spine.'],
            move: ['Move the hips back and forward while the spine stays long.', 'Load the hamstrings before driving the hips through.', 'Finish tall with the glutes instead of leaning back.']
        },
        single_leg: {
            family: 'Single-leg strength',
            force: 'The working foot owns the ground while the hip and core keep the pelvis level so force can travel cleanly through the leg.',
            setup: ['Plant a tripod foot and point the knee over the middle toes.', 'Square and level the pelvis.', 'Brace before lowering so the torso stays controlled.'],
            move: ['Let the working hip and knee share the load.', 'Drive through the whole foot.', 'Use the other leg for balance only when the variation calls for it.']
        },
        squat: {
            family: 'Squat pattern',
            force: 'The feet push the floor or platform away while hips and knees share the load and the trunk transfers force to the weight.',
            setup: ['Build a tripod foot through heel, big toe, and little toe.', 'Stack ribs over pelvis and unlock hips and knees together.', 'Track knees in the same direction as the toes.'],
            move: ['Sit between the hips without collapsing the feet.', 'Keep the torso as upright as your build and variation allow.', 'Drive the floor away and finish tall without leaning back.']
        },
        hip_extension: {
            family: 'Hip extension',
            force: 'The glutes extend the hip while the feet, floor, bench, or cable provide resistance and the trunk keeps the pelvis from tipping.',
            setup: ['Bring ribs toward pelvis before squeezing the glutes.', 'Set the feet or working leg so the hip, not the low back, owns the movement.', 'Keep the pelvis level and knees tracking cleanly.'],
            move: ['Drive from the hip and keep the low back quiet.', 'Pause at full hip extension without flaring the ribs.', 'Lower slowly until the glutes lengthen under control.']
        },
        hip_abduction: {
            family: 'Hip abduction',
            force: 'The outer hip moves or stabilises the thigh while the trunk and pelvis stay quiet against the band, cable, machine, or gravity.',
            setup: ['Stack the pelvis instead of rolling it backward.', 'Keep the working knee and toes facing the intended direction.', 'Brace lightly so the waist does not take over.'],
            move: ['Lead from the outside of the hip.', 'Use the range you can achieve without hiking the pelvis.', 'Return slowly instead of letting the resistance snap the leg inward.']
        },
        hip_adduction: {
            family: 'Hip adduction',
            force: 'The inner thigh draws the leg inward or holds the pelvis steady while the trunk stays stacked.',
            setup: ['Set the pelvis level and keep the spine long.', 'Align the working leg with the cable, pad, ball, or floor.', 'Use a range that does not pinch the groin.'],
            move: ['Draw inward from the inner thigh without rotating the pelvis.', 'Pause briefly at peak tension.', 'Return under control and keep the supporting side steady.']
        },
        hip_flexion: {
            family: 'Hip flexion',
            force: 'The hip flexors lift the thigh while the trunk and pelvis resist tipping or twisting.',
            setup: ['Stack ribs over pelvis and stand or lie tall.', 'Keep the supporting side steady.', 'Choose a range that does not pinch the front of the hip.'],
            move: ['Lift from the front of the hip without leaning backward.', 'Keep the pelvis level and the knee tracking forward.', 'Lower slowly instead of dropping the leg.']
        },
        knee_flexion: {
            family: 'Knee flexion',
            force: 'The hamstrings bend the knee while the machine, ball, slider, or gravity provides resistance and the pelvis remains controlled.',
            setup: ['Anchor the hips and keep ribs down.', 'Align the knee with the machine hinge or direction of travel.', 'Set the roller, ball, or sliders securely before starting.'],
            move: ['Pull the heel toward the glute without lifting the hips.', 'Pause where the hamstrings are shortest.', 'Lengthen the knee slowly without losing pelvic position.']
        },
        knee_extension: {
            family: 'Knee extension',
            force: 'The quadriceps straighten the knee against the pad, band, or gravity while the thigh and pelvis stay supported.',
            setup: ['Anchor the hips and low back.', 'Align the knee with the machine hinge or resistance line.', 'Keep kneecap and toes pointing the same direction.'],
            move: ['Straighten the knee smoothly and squeeze the quad.', 'Avoid kicking or bouncing into lockout.', 'Lower with control until the quad lengthens.']
        },
        calf: {
            family: 'Calf and ankle drive',
            force: 'The calf pushes through the ball of the foot while the foot tripod and ankle keep force travelling straight.',
            setup: ['Keep the big toe, little toe, and heel connected before rising.', 'Stack the leg over the foot.', 'Use support if balance limits the calf.'],
            move: ['Lift the heel without rolling to the outside edge.', 'Pause tall through the big toe.', 'Lower slowly through the available ankle range.']
        },
        upper_back_rear: {
            family: 'Rear shoulder and scapula',
            force: 'The rear shoulder and upper back guide the arms around a stable rib cage while the shoulder blades move without shrugging.',
            setup: ['Set a long neck and softly stacked ribs.', 'Use a light enough load to keep the arms and shoulder blades controlled.', 'Start with shoulders wide rather than pinched together.'],
            move: ['Lead with the elbows or backs of the arms.', 'Open until the upper back works without the neck taking over.', 'Return slowly and allow the shoulder blades to glide forward.']
        },
        vertical_pull: {
            family: 'Vertical pull',
            force: 'The hands anchor to the bar or handle while the lats and shoulder blades pull the upper arms toward the rib cage.',
            setup: ['Brace ribs over pelvis and keep the neck long.', 'Use a grip that lets wrists stay straight.', 'Begin with shoulder blades free to upwardly rotate.'],
            move: ['Pull elbows down toward the sides of the body.', 'Keep the chest open without leaning far backward.', 'Return to a controlled overhead stretch without shrugging abruptly.']
        },
        horizontal_pull: {
            family: 'Horizontal pull',
            force: 'The trunk provides a stable base while the upper back guides the elbow behind the body and transfers force through the shoulder blade.',
            setup: ['Brace the torso before the pull.', 'Reach long at the shoulder blade without rounding the low back.', 'Keep wrist, elbow, and resistance line organised.'],
            move: ['Guide the elbow back without twisting the torso unless rotation is prescribed.', 'Keep the shoulder away from the ear.', 'Return slowly until the shoulder blade glides forward.']
        },
        shoulder_rotation: {
            family: 'Shoulder rotation and control',
            force: 'The rotator cuff centres the upper-arm bone while the shoulder blade and rib cage provide a stable, moving base.',
            setup: ['Use a very light resistance and keep the neck relaxed.', 'Set the elbow in the prescribed position without forcing the shoulder down.', 'Keep ribs stacked so the low back does not create the range.'],
            move: ['Rotate from the shoulder without moving the elbow or wrist unnecessarily.', 'Stay in a smooth, pain-free range.', 'Return slowly and keep tension consistent.']
        },
        chest_fly: {
            family: 'Chest fly',
            force: 'The pecs draw the arms around a stable rib cage while the bench, floor, or stance supports the trunk.',
            setup: ['Widen the collarbones and keep ribs controlled.', 'Use a soft elbow bend and neutral wrists.', 'Set the shoulders broad rather than forcing them down.'],
            move: ['Arc the arms until the chest stretches without shoulder pinch.', 'Bring the arms together by squeezing through the pecs.', 'Control the return instead of dropping into the bottom.']
        },
        horizontal_press: {
            family: 'Horizontal press',
            force: 'The hands push the bar, floor, or handles away while the trunk connects that force to a stable rib cage and pelvis.',
            setup: ['Stack wrists over elbows.', 'Open the chest without flaring the ribs.', 'For push-ups, keep a straight line from head through hips.'],
            move: ['Track elbows about 30 to 60 degrees from the body.', 'Press away while keeping the neck long.', 'Finish without the hips sagging or shoulders rolling forward.']
        },
        vertical_press: {
            family: 'Vertical press',
            force: 'The lower body and trunk provide the platform while the shoulders press overhead and the shoulder blades rotate naturally.',
            setup: ['Stack ribs over pelvis and lightly brace the glutes.', 'Start with wrists over elbows.', 'Keep the shoulder blades free to rotate upward.'],
            move: ['Press up and slightly back toward a stacked finish.', 'Keep the ribs from lifting to create fake shoulder range.', 'Lower under control to the start position you can own.']
        },
        shoulder_raise: {
            family: 'Shoulder raise',
            force: 'The trunk prevents swinging while the deltoids and shoulder blades guide the arms against gravity or cable resistance.',
            setup: ['Stand tall with ribs stacked.', 'Use a soft elbow bend and quiet wrists.', 'Choose a load that does not pull the shoulders toward the ears.'],
            move: ['Raise in the intended plane without throwing the torso.', 'Stop before the neck takes over.', 'Lower more slowly than you lift.']
        },
        forearm: {
            family: 'Grip and forearm',
            force: 'The forearm controls the wrist and fingers while the elbow and shoulder provide a stable base.',
            setup: ['Support the forearm when the variation allows it.', 'Start with the wrist in line with the forearm.', 'Use a load that permits full finger and wrist control.'],
            move: ['Move only through the intended wrist or grip action.', 'Avoid using elbow or shoulder momentum.', 'Return slowly through the available range.']
        },
        biceps: {
            family: 'Elbow flexion',
            force: 'The biceps and other elbow flexors bend the arm while the shoulder and trunk stop the load from swinging.',
            setup: ['Keep ribs stacked and shoulders relaxed.', 'Set the upper arm in the position the variation requires.', 'Grip without letting the wrist fold backward.'],
            move: ['Bend the elbow without leaning away from the load.', 'Pause before the shoulder rolls forward.', 'Lower until the elbow opens under control.']
        },
        triceps: {
            family: 'Elbow extension',
            force: 'The triceps straighten the elbow while the shoulder and trunk hold the upper arm in a stable position.',
            setup: ['Stack ribs and pelvis before moving the elbow.', 'Keep shoulders wide and neck relaxed.', 'Align wrist, elbow, and resistance line.'],
            move: ['Straighten from the elbow and finish with a triceps squeeze.', 'Keep the upper arm controlled.', 'Return slowly until the triceps lengthen without shoulder irritation.']
        },
        locomotion: {
            family: 'Locomotion and conditioning',
            force: 'Repeated steps or pushes transfer force between the ground and the whole body while posture and rhythm manage fatigue.',
            setup: ['Stand tall and choose a pace you can sustain cleanly.', 'Keep feet and knees tracking in the direction of travel.', 'Brace enough to stop the trunk collapsing as fatigue builds.'],
            move: ['Use quiet, repeatable contacts with the ground.', 'Keep breathing rhythmic instead of sprinting the first interval.', 'Slow down before technique becomes noisy or uncontrolled.']
        },
        general: {
            family: 'Whole-body control',
            force: 'Support points create an opposing force while the working joints move and the trunk keeps that force travelling through the body cleanly.',
            setup: ['Stack ribs over pelvis and brace before moving.', 'Keep pressure even through the support points.', 'Set the working joints in a comfortable, strong line.'],
            move: ['Move with control and keep joints tracking naturally.', 'Let the target area move while the rest of the body stays organised.', 'Own the end range and reverse without bouncing.']
        }
    };

    function normalizeExerciseName(value) {
        return String(value || '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\.mp4.*$/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function any(name, expressions) {
        return expressions.some((expression) => expression.test(name));
    }

    function classifyExercise(exerciseName) {
        const name = normalizeExerciseName(exerciseName);
        if (!name || /^rest(?: day)?$/.test(name) || /video player is loading/.test(name)) return 'non_exercise';

        const pilatesCoreStretch = /^pilates .*\b(?:single|double) leg stretch\b/.test(name);
        if (any(name, [/\bfoam roll(?:er)?\b/, /\bmassage\b/, /\bmyofascial\b/, /\btrigger point\b/, /\bmuscle smash\b/, /\bfloss(?:ing)?\b/, /\bbreathing\b/, /\bmeditation\b/, /\bbody scan relaxation\b/, /\bintegration rest\b/])) return 'recovery';
        if (!pilatesCoreStretch && any(name, [/^yoga\b/, /\bstretch(?:es)?\b/, /\bmobility\b/, /\bposes?\b/, /\bopener\b/, /\brelease\b/, /\b90 90\b/, /\bcontrolled articular rotations?\b/, /\bforward fold\b/, /\bdownward dog\b/, /\bdown dog\b/, /\bhip circles?\b/, /\bankle (?:circles?|alphabets?|inversion|dorsiflexion|plantar and dorsiflexion)\b/, /\bfrog rockbacks?\b/, /\bpass through\b/, /\bdislocates?\b/, /\bcat (?:to )?cow\b/, /\bcobra\b/, /\bsavasana\b/, /\bsun salutation\b/, /\bflow sequence\b/, /\bground flow\b/, /\bstanding flow\b/, /\bquadruped rock back\b/, /\bhip opening flow\b/, /\bhalf lord of the fishes\b/, /\bthread the needle\b/, /\bback bend\b/, /\bshoulder rolls?\b/, /\bshoulder flexion\b/, /\barm hugs?\b/, /\bwarrior 2\b/, /\bgroiner\b/, /\bcrouching tiger\b/, /\bhip can openers?\b/, /\bsprawling pretzel\b/, /\bprone scorpion\b/, /\blegs up the wall\b/, /\breclined butterfly\b/, /\bknees to chest\b/, /\balternating knee hug\b/, /\balternating high kick\b/, /\balternating floor sweep\b/, /\bpilates (?:swan|standing roll down)\b/])) return 'mobility';
        if (any(name, [/\bjumps?\b/, /\bjumping\b/, /\bhop(?:s|ping)?\b/, /\bbound(?:s|ing)?\b/, /\bburpee\b/, /\bslam(?:s|ming)?\b/, /\bsmash\b/, /\btoss\b/, /\bthrows?\b/, /\bclean\b/, /\bsnatch\b/, /\bjerk\b/, /\bexplosive\b/, /\bplyo/, /\bthruster\b/, /\bsnap down\b/, /\bskaters?\b/, /\bpower pull\b/, /\bhigh pulls?\b/])) return 'power';
        if (any(name, [/\bcarry\b/, /\bfarmer(?:s)? walk\b/, /\bsuitcase walk\b/, /\bwaiter(?:s)? walk\b/])) return 'carry';
        if (any(name, [/\bneck\b/, /\bcervical\b/])) return 'neck';
        if (any(name, [/\bexternal (?:shoulder )?rotations?\b/, /\binternal (?:shoulder )?rotations?\b/, /\brotator cuff\b/, /\bwall slides?\b/, /\bscapular push ?ups?\b/, /\bshoulder car\b/, /\barm swimmers?\b/, /\barm circles?\b/, /\bkettlebell arm bar\b/, /\bbus drivers?\b/])) return 'shoulder_rotation';
        if (any(name, [/\brotations?\b/, /\brotational\b/, /\btwists?\b/, /\btwisting\b/, /\bwood ?chops?\b/, /\bchops?\b/, /\bpallof\b/, /\banti rotation\b/, /\bside bends?\b/, /\bwindmills?\b/, /\bdiagonal chops?\b/, /\brainbows?\b/, /\bturkish get ?up\b/, /\bfigure 8s?\b/, /\bhalos?\b/, /\bpass around the body\b/, /\bcrab reach\b/, /\bkick throughs?\b/, /\bunderswitch\b/, /\bbear to step through\b/, /\bcable push pull\b/, /\bthrough legs\b/])) return 'core_rotation';
        if (any(name, [/\bjacknife\b/, /\bswimmers?\b/, /\bpilates ball (?:pick ups|weighted pulse)\b/, /\bpilates (?:seal|leg pull|leg beats|saw|rolling|roll like|rocking|open leg rocker|oblique roll back|ball pass|arm reach|swimming)\b/, /\blandmine overhead hold\b/, /\bbear to stand\b/])) return 'core_bracing';
        if (any(name, [/\bplanks?\b/, /\bcrunch(?:es)?\b/, /\bsit ?ups?\b/, /\bdead ?bug\b/, /\bbird ?dog\b/, /\bhollow\b/, /\bab roller\b/, /\bab wheel\b/, /\bleg raises?\b/, /\bleg lowers?\b/, /\bleg drops?\b/, /\bknee tucks?\b/, /\bknee drives?\b/, /\bknee to head raises?\b/, /\bmountain climbers?\b/, /\btoe taps?\b/, /\btoe touches?\b/, /\btoe touch progression\b/, /\btoe reaches?\b/, /\bteaser\b/, /\bhundred\b/, /\bjack ?knife\b/, /\bcorkscrew\b/, /\bbicyc?le\b/, /\broll ?ups?\b/, /\broll outs?\b/, /\bv ups?\b/, /\bv sits?\b/, /\bv hold\b/, /\bv tuck\b/, /\bl sit hold\b/, /\bdragon flag\b/, /\bflutter kicks?\b/, /\bscissors\b/, /\bbear crawl\b/, /\bleopard crawl\b/, /\bmonkey crawl\b/, /\bdead crawl\b/, /\bshoulder taps?\b/, /\bknees? to elbows?\b/, /\btoes to (?:bar|rings)\b/, /\bbody saw\b/, /\bstir the pot\b/, /\bpikes?\b/, /\bpassovers?\b/, /\bsuperman\b/, /\bpilates .*leg stretch\b/, /\bpilates (?:seal|leg pull|leg beats|saw|rolling|roll like|open leg rocker|oblique roll back|ball pass|arm reach|swimming)\b/, /\bwindshield wipers?\b/, /\bquadruped hold\b/, /\bsingle leg tuck\b/, /\bbanded tuck\b/, /\bwalkouts?\b/, /\blandmine rollout\b/, /\bbar hang\b/, /\bhandstand hold\b/])) return 'core_bracing';
        if (any(name, [/\bdeadlifts?\b/, /\brdls?\b/, /\brlds?\b/, /\bromanian\b/, /\bhip hinge\b/, /\bgood mornings?\b/, /\bswings?\b/, /\bback extensions?\b/, /\bhyper ?extensions?\b/, /\bghd (?:extension|reverse hyper)/, /\breverse hyper/, /\bglute ham raise\b/, /\bpull through\b/, /\blateral hinge\b/, /\bsingle leg lean forward bend\b/])) return 'hinge';
        if (any(name, [/\bhip abductions?\b/, /\b(?:machine|mini band) seated abduction\b/, /\bside lying (?:oblique )?leg (?:lifts?|raises?|pulse)\b/, /\bside kick series\b/, /\bside lying develop/, /\bsingle leg circles?\b/, /\bkneeling side kick\b/, /\bclams?(?:hell)?s?\b/, /\bfire hydrants?\b/, /\bside steps?\b/, /\blateral band walks?\b/, /\bdirty dog\b/, /\bglute side circle\b/, /\blateral hip drop\b/, /\bhip airplane\b/])) return 'hip_abduction';
        if (any(name, [/\bhip adductions?\b/, /\badductors?\b/, /\binner thigh\b/, /\bball squeeze\b/])) return 'hip_adduction';
        if (any(name, [/\bhip flexions?\b/, /\bknee raises?\b/, /\bleft right up kicks\b/])) return 'hip_flexion';
        if (any(name, [/\bhip thrusts?\b/, /\bglute thrusters?\b/, /\bglute bridges?\b/, /\bsingle leg bridge\b/, /\bshoulder bridges?\b/, /\bhamstring bridge\b/, /\bhip raises?\b/, /\bfrog pumps?\b/, /\bkick ?backs?\b/, /\bdonkey kicks?\b/, /\bhip extensions?\b/, /\bhip press\b/, /\bpilates .*leg kicks?\b/, /\bpilates frog\b/])) return 'hip_extension';
        if (any(name, [/\blunges?\b/, /\bsplit squats?\b/, /\bbulgarian(?:s)?\b/, /\bstep ?ups?\b/, /\bstep ?downs?\b/, /\bcurtsy\b/, /\bcossack\b/, /\bpistol squats?\b/, /\bsingle leg squats?\b/, /\bskater squats?\b/, /\bsingle leg lying press\b/])) return 'single_leg';
        if (any(name, [/\bsquats?\b/, /\bsumo heels elevated pulses\b/, /\bleg press\b/, /\bhack (?:squat|press)\b/, /\bwall sit\b/, /\bplie\b/])) return 'squat';
        if (any(name, [/\breverse fly(?:s|es)?\b/, /\bback fly(?:s|es)?\b/, /\brear delts?\b/, /\bface pulls?\b/, /\bpull aparts?\b/, /\bband dislocates?\b/, /\bshrugs?\b/, /\btrap 3 raise\b/, /\b(?:ys|ts|is)\b/, /\b[ytis] delt fly\b/, /\bbent over y s\b/, /\bstanding [yi] s\b/, /\bsplit rear fly\b/, /\blow delt fly\b/, /\bisometric fly drag\b/, /\bprone (?:t|y|w|arm swimmer)/, /\bscapular retraction\b/, /\bwall angels?\b/, /\byes nos\b/])) return 'upper_back_rear';
        if (any(name, [/\bpull ?ups?\b/, /\bchin ?ups?\b/, /\bpull ?downs?\b/, /\bpulldowns?\b/, /\blat pulls?\b/, /\blat machine\b/, /\bpullovers?\b/, /\bmuscle ups?\b/, /\bdead hang\b/, /\bshoulder adduction\b/])) return 'vertical_pull';
        if (/\bupright rows?\b/.test(name)) return 'shoulder_raise';
        if (any(name, [/\brows?\b/, /\brope pulls?\b/, /\bbench pull\b/])) return 'horizontal_pull';
        if (any(name, [/\bleg curls?\b/, /\bhamstring curls?\b/, /\blap curls?\b/, /\bnordic curls?\b/, /\bhamstring runners?\b/, /\blying slider runner\b/])) return 'knee_flexion';
        if (any(name, [/\bleg extensions?\b/, /\bquad extensions?\b/, /\bsissy squats?\b/])) return 'knee_extension';
        if (any(name, [/\bcalf raises?\b/, /\bheel raises?\b/, /\bplantar ?flexion\b/, /\bpogo raises?\b/])) return 'calf';
        if (any(name, [/\bwrist\b/, /\bforearm\b/, /\bgrip\b/, /\bpronation\b/, /\bsupination\b/])) return 'forearm';
        if (any(name, [/\btriceps?\b/, /\bskull ?crushers?\b/, /\bpush ?downs?\b/, /\belbow extensions?\b/, /\bcable extension\b/])) return 'triceps';
        if (any(name, [/\bbiceps?\b/, /\bhammer curls?\b/, /\bpreacher curls?\b/, /\bzottman\b/, /\belbow curls?\b/, /\bcurls?\b/, /\b21\b/])) return 'biceps';
        if (any(name, [/\bchest fly(?:s|es)?\b/, /\bpec fly(?:s|es)?\b/, /\bcable fly(?:s|es)?\b/, /\bsuspension fly(?:s|es)?\b/, /\bhigh to low fly\b/, /\blow to high fly\b/, /\bstanding fly\b/, /\bflat bench fly\b/, /\bincline bench fly\b/, /\bfly floor\b/, /\bcross ?over\b/, /\bfly(?:s|es)?\b/])) return 'chest_fly';
        if (any(name, [/\bchest press(?:es)?\b/, /\bbench press(?:es)?\b/, /\bfloor press(?:es)?\b/, /\bincline press\b/, /\bdecline press\b/, /\bdecline bench\b/, /\bincline bench\b/, /\bpush ?ups?\b/, /\bdips?\b/, /\bpec press(?:es)?\b/, /^banded press$/, /\bs a banded press\b/])) return 'horizontal_press';
        if (any(name, [/\bshoulder press(?:es)?\b/, /\boverhead press(?:es)?\b/, /\bmilitary press(?:es)?\b/, /\bmillitary press\b/, /\barnold press(?:es)?\b/, /\bpush press(?:es)?\b/, /\blandmine (?:.* )?press\b/, /\bhalf kneeling .* press\b/, /\bkneeling cable s a press\b/, /\bcable single arm kneeling press\b/, /\bsingle arm strict press\b/, /\bbottoms? up press\b/, /\balternating press\b/, /\batlas press\b/, /\bclean to press\b/, /\bclean and press\b/, /\boverhead dumbell\b/])) return 'vertical_press';
        if (any(name, [/\blateral raises?\b/, /\blat raise\b/, /\bfront raises?\b/, /\bshoulder raises?\b/, /\by raises?\b/, /\bupright rows?\b/, /\baround the world\b/, /\b6 way\b/, /\bscaptions?\b/, /\biron cross raise\b/, /\bdelt raises?\b/])) return 'shoulder_raise';
        if (any(name, [/\bwalking\b/, /\bwalk\b/, /\bjog\b/, /\brunning\b/, /\brun\b/, /\bmarching\b/, /\bmarch\b/, /\bhigh knees\b/, /\bgoose step\b/, /\bsprinters?\b/, /\bagility\b/, /\b[ab] skip\b/, /\bdouble under\b/, /\bshuttle\b/, /\bfast feet\b/, /\bbutt kickers?\b/, /\bcarioca\b/, /\bsled push\b/, /\bsled drag\b/, /\bsled pulls?\b/, /\bbattle rope\b/, /\bjumping rope\b/, /\bjump rope\b/, /\bskipping\b/, /\bcycling\b/, /\browing machine\b/, /\bski erg\b/, /\bskiiers?\b/, /\bbench up overs\b/])) return 'locomotion';
        if (any(name, [/\bbalance\b/, /\bsingle leg stand\b/, /\bbosu\b/, /\bwobble board\b/])) return 'balance';
        return 'general';
    }

    function getExerciseTechniqueData(exerciseName) {
        const key = classifyExercise(exerciseName);
        const template = TEMPLATES[key] || TEMPLATES.general;
        const data = {
            key,
            family: template.family,
            force: template.force,
            setup: template.setup.slice(),
            move: template.move.slice(),
            reset: RESET
        };
        if (template.hidePanel) data.hidePanel = true;
        return data;
    }

    function auditExerciseNames(exerciseNames) {
        const names = Array.isArray(exerciseNames) ? exerciseNames : [];
        const totals = {};
        const fallback = [];
        const invalid = [];
        const suspicious = [];
        names.forEach((exerciseName) => {
            const data = getExerciseTechniqueData(exerciseName);
            totals[data.key] = (totals[data.key] || 0) + 1;
            if (data.key === 'general') fallback.push(exerciseName);
            if (!data.family || !data.force || data.setup.length < 3 || data.move.length < 3) invalid.push(exerciseName);
            const normalized = normalizeExerciseName(exerciseName);
            if (data.key === 'chest_fly' && /\breverse|rear|back\b/.test(normalized)) suspicious.push({ exerciseName, key: data.key, reason: 'rear-shoulder fly classified as chest fly' });
            if (data.key === 'shoulder_raise' && /\bbound|crawl|lunge|step down\b/.test(normalized)) suspicious.push({ exerciseName, key: data.key, reason: 'lower-body lateral movement classified as shoulder raise' });
            if (data.key === 'vertical_press' && /\btricep|carry|side bend\b/.test(normalized)) suspicious.push({ exerciseName, key: data.key, reason: 'non-press overhead movement classified as vertical press' });
            if (!['mobility', 'recovery'].includes(data.key) && /\bfoam roll|stretch|mobility|pose\b/.test(normalized) && !/^pilates .*leg stretch\b/.test(normalized)) suspicious.push({ exerciseName, key: data.key, reason: 'mobility/recovery exercise classified as strength' });
            if (data.key === 'horizontal_press' && /\brow\b/.test(normalized)) suspicious.push({ exerciseName, key: data.key, reason: 'row classified as press' });
            if (/\b(?:external|internal) shoulder rotation\b/.test(normalized) && data.key !== 'shoulder_rotation') suspicious.push({ exerciseName, key: data.key, reason: 'shoulder rotation classified outside rotator-cuff family' });
            if (/\bupright row\b/.test(normalized) && !/\b(?:deadlift|rdl)\b/.test(normalized) && data.key !== 'shoulder_raise') suspicious.push({ exerciseName, key: data.key, reason: 'upright row classified outside shoulder-raise family' });
        });
        return { total: names.length, totals, fallback, invalid, suspicious };
    }

    return {
        TEMPLATES,
        normalizeExerciseName,
        classifyExercise,
        getExerciseTechniqueData,
        auditExerciseNames
    };
});
