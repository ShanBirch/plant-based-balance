# FitGotchi animation audit

Audited 11 September 2026. Source: live Backblaze model files referenced by the current evolution and rare-character collections.

## Scope and evidence

- Inventoried clip names and durations in all 98 referenced model files. The compact recorded inventory is tests/fixtures/fitgotchi-clips.json.
- Reviewed six poses across every one of the 55 shared clips using level_50_real_final.glb as the visual reference, all 55 female-starter clips, all 15 Shanbot clips, and the baby's resting/laugh tracks. Shared names and durations are not a claim that all 98 meshes were individually rendered.
- Compared decoded skeletal rotations and durations against the reference to identify swapped female tracks and the baby's missing laugh. The baby's NlaTrack.055 is the real laugh, not disposable internal data.
- Reviewed the three non-animated meshes: 43.glb, 73.glb and 77.glb are unrigged T-poses. They cannot breathe or bend until the assets are rigged/replaced. Preserve ownership and skin selection; show an honest fixed-pose message instead of fake move buttons.
- Earlier site work is preserved in commits 9a60bc24 and a81b3b1f (2 February 2026), 1f372465 and c4e5ced5. It aligned names against earlier assets but did not account for current per-model differences.

## Repair contract

Run `node scripts/audit-fitgotchi-models.mjs` before adopting new model exports. This read-only check compares the live clip lists and durations against the reviewed baseline. A matching inventory cannot prove unchanged animation content; changed or replaced assets still need visual review.

- Keep existing action IDs and unlock levels. Resolve the action against the currently loaded model, never against an animation index or a substring.
- Hide unavailable and duplicate actions. The female starter's strut slot is labelled Forward Flip. Shanbot's smaller vocabulary has explicit aliases.
- Load the resolver before model-viewer. Start resting on the load event, including when the dashboard controller arrives late or a phone recreates the viewer.
- Update the selected clip while paused to clear previously faded actions, then await the model-viewer update before playing. Reset selected moves to zero, play once, and return to the relaxed loop on the real finished event. One playback owner prevents old timers/taps affecting a newer move or skin; an outgoing crossfade completion cannot cut the current move short or freeze resting.
- Rest: shared/baby idle; female starter stand (its idle is actually clapping); Shanbot stand (relaxed head turns and weight shifts). Never choose a hit/dance/sad/T-pose/first clip as idle.

## Available move counts

| Model | Menu moves |
| --- | ---: |
| level_50_real_final.glb | 54 |
| level_1_female_final.glb | 39 |
| shanbot_final.glb | 14 |
| baby_full_animations.glb | 54 |

## Label and clip mapping

A dash means the actual movement is absent from that export, so no button is offered. The resting loop is automatic and does not need an unlock.

| Stable action | Label | Level | Shared clip | Female starter clip | Baby clip | Shanbot clip | Visual identification |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| walk | Walk | 1 | walk | karate | walk | - | Walks forward. |
| greet | Greet | 1 | greet | - | greet | greet | Arm gesture greeting. |
| agree | Agree | 1 | agree | agree | agree | agree | Nod and small agreeing hand gesture. |
| laugh | Laugh | 1 | laugh | - | NlaTrack.055 | laugh | Bends forward laughing; straightens again. |
| boxing | Boxing | 1 | boxing | laugh_2 | boxing | - | Boxing punches from a guard stance. |
| fold_arms | Fold Arms | 3 | fold_arms | - | fold_arms | fold_arms | Crosses arms, holds, then releases. |
| bow | Bow | 5 | bow | bow | bow | - | Bends from waist in a bow. |
| sad_stand | Sad | 5 | sad_stand | - | sad_stand | - | Slumped posture and lowered head. |
| clap | Clap | 5 | clap | clap | clap | - | Claps hands repeatedly. |
| warm_up | Warm Up | 5 | warm_up | warm_up | warm_up | - | Full-body warm-up with bends and arm/leg movements. |
| dance | Dance | 5 | dance | dance_2 | dance | dance | Short rhythmic twist and bounce. |
| angry | Angry | 8 | angry | hit_to_2 | angry | - | Throws arms up in frustration. |
| laugh_1 | Giggle | 8 | laugh_1 | die | laugh_1 | - | Hand-to-mouth giggle. |
| angry_2 | Furious | 8 | angry_2 | angry_2 | angry_2 | - | Emphatic frustrated gestures. |
| greet_1 | Big Wave | 10 | greet_1 | - | greet_1 | - | Large raised-arm greeting. |
| greet_2 | Wave | 10 | greet_2 | greet_2 | greet_2 | - | Raised-hand wave. |
| angry_1 | Annoyed | 10 | angry_1 | - | angry_1 | - | Bent-over frustrated arm gestures. |
| stretch | Stretch | 10 | stretch | laugh_1 | stretch | - | Bends down and stretches arms across the chest. |
| kick | Kick | 10 | kick | kick | kick | kick | Forward/high kick. |
| hit_to_2 | Stagger | 10 | hit_to_2 | - | hit_to_2 | - | Staggers from an impact. |
| stand_hands_on_hips | Ready Stance | 10 | stand_hands_on_hips | - | stand_hands_on_hips | - | Bent elbows held beside waist; ready stance. |
| strut | Strut | 10 | strut | strut | strut | - | Exaggerated forward strut; female starter has a forward flip instead. |
| lose | Lose | 15 | lose | lose | lose | dissapointed | Disappointed slump and head-back reaction. |
| pushup | Push-Up | 15 | pushup | pushup | pushup | push_up | Push-up repetition. |
| karate | Karate | 15 | karate | angry_1 | karate | - | Martial arts punch sequence. |
| hit_to_head | Head Hit | 15 | hit_to_head | dance | hit_to_head | big_hit | Head and torso recoil backwards. |
| hit_to_side | Side Hit | 15 | hit_to_side | arms_up_still | hit_to_side | hit | Sideways torso recoil. |
| dance_1 | Side Step | 15 | dance_1 | - | dance_1 | - | Side steps with swinging arms. |
| arms_up_still | Guard Stance | 15 | arms_up_still | sad_stand | arms_up_still | - | Holds a guard stance with bent elbows; not raised overhead arms. |
| laugh_3 | Cracking Up | 15 | laugh_3 | - | laugh_3 | - | Bends forward with a larger laughing reaction. |
| say_goodbye | Goodbye | 20 | say_goodbye | say_goodbye | say_goodbye | - | Farewell hand gesture. |
| depressed_walk | Sad Walk | 20 | depressed_walk | depressed_walk | depressed_walk | - | Slumped, downcast walk. |
| angry_3 | Rage | 20 | angry_3 | angry_3 | angry_3 | - | Angry bent-over gesture and step. |
| heart_pose | Heart Pose | 20 | heart_pose | heart_pose | heart_pose | - | Makes a heart-like shape overhead. |
| basketball | Basketball | 20 | basketball | basketball | basketball | - | Travelling basketball movement. |
| boxing_1 | Boxing Combo | 20 | boxing_1 | boxing_1 | boxing_1 | - | Forward boxing combination. |
| hit_to_3 | Heavy Hit | 20 | hit_to_3 | hit_to_3 | hit_to_3 | - | Larger impact recoil. |
| stand | Relaxed Stand | 20 | stand | stand | stand | idle | Relaxed standing and subtle breathing. |
| dance_2 | Step & Sway | 20 | dance_2 | - | dance_2 | - | Stepping and swaying dance. |
| angry_walk | Angry Walk | 25 | angry_walk | angry_walk | angry_walk | angry_walk | Hunched, forceful walk. |
| laugh_2 | LOL | 25 | laugh_2 | - | laugh_2 | - | Long laughing reaction with hand near face. |
| volleyball | Volleyball | 25 | volleyball | volleyball | volleyball | - | Travelling volleyball jump/strike. |
| hit_to_1 | Body Hit | 25 | hit_to_1 | - | hit_to_1 | - | Body-hit recoil. |
| dance_3 | Arm Swing | 25 | dance_3 | - | dance_3 | - | Dance with broad arm swings. |
| pitch | Baseball Pitch | 30 | pitch | - | pitch | - | Winds up and throws a baseball pitch. |
| cartwheel | Cartwheel | 30 | cartwheel | cartwheel | cartwheel | - | Full cartwheel. |
| dance_4 | Freestyle | 30 | dance_4 | dance_4 | dance_4 | - | Long freestyle dance. |
| boxing_2 | Boxing Pro | 30 | boxing_2 | boxing_2 | boxing_2 | - | Low duck into a boxing combination. |
| dance_5 | Dance Shuffle | 35 | dance_5 | dance_5 | dance_5 | - | Shuffling dance with knee lifts. |
| kick_2 | Spin Kick | 40 | kick_2 | kick_2 | kick_2 | spin_kick | Spinning high kick. |
| sit | Sit Down | 40 | sit | sit | sit | - | Sits and leans forward. |
| block | Block | 40 | block | block | block | scared | Defensive flinch/guard. |
| die | Drama Fall | 50 | die | dance_1 | die | - | Dramatic forward fall. |
| die_1 | Play Dead | 60 | die_1 | die_1 | die_1 | - | Backward/sideways collapse. |
| idle | Resting loop | 1 | idle | stand | idle | stand | Relaxed weight shifts, head turns and hands moving behind back. |

## Next asset work

43.glb, 73.glb and 77.glb need an actual skeleton and weights (or their original animated exports). Do not invent a clip mapping, shift another character into the same owned skin, or hide their T-pose by claiming this code repair animated them.
