# Workout load feedback

Prepared against main `1d647096ea43e3bef9a451b2c2ea749ac8ca883f`, preserving the voice fix. Publication is held for review.

## Findings

The previous UI asked “How hard was your workout?” on an Easy–Hard slider, reset to 3 on every opening. Saving accepted that untouched default. Difficulty 4–5 generated `intensity_preference=lighter`, 1–2 generated `harder`, and 3 generated `perfect`. These were inferred values, not explicit requests. `overall_feeling` duplicates the separate energy slider, which also defaults to 3. It is not independent mood evidence.

The reported Arunima difficulty 4 / energy 3 / lighter rows therefore do not prove she requested lighter training. Her earlier perfect row also cannot prove an intentional choice. No client rows, messages or programs were changed or independently queried for this patch.

## Storage and interpretation

New UI asks “How did the workout load feel?” with exactly Too light, Perfect and Too heavy. No choice is selected. Save requires one choice; Skip or back discards it. Reopening starts unanswered, rather than editing a prior saved rating. The separate energy slider is preserved.

The existing constrained preference field is retained for compatibility: Too light maps to harder, Perfect to perfect, Too heavy to lighter. This indicates a possible adjustment direction, not an explicit request for a program change.

No migration is required. The existing text `notes` field carries JSON with `feedback_version=workout_load_buttons_v1`, `load_choice=too_light|perfect|too_heavy`, and `difficulty_source=compatibility_mapping`. The mandatory difficulty column receives compatibility scores 1/3/5. These scores are excluded from the historical difficulty average. This metadata survives the real persistence helper and the existing offline queue. Existing free-text notes and legacy rows remain unchanged.

Insights count only versioned choices in the load breakdown, label historical rows “Earlier slider rating”, and keep their original scores in the earlier difficulty average. Coach/check-in/admin prompt guidance rejects interpreting unversioned lighter/harder values as client requests and explains the new metadata.

The UI uses inherited fonts, theme variables, 52px minimum buttons, keyboard focus, `aria-pressed` selected state, one active choice and safe existing modal scrolling. Both feature discovery paths explain the buttons. Asset versions and the service-worker cache were updated.

## Verification

- 29 focused tests passed: new interaction/persistence/history cases, rating completion/theme, weekly review alignment, check-in thread context, conversation policy and tour target placement.
- Wider checks: 44 of 46 passed. The two failures (onboarding tour sequence and an outdated workout-volume asset-version assertion) also fail against the original HEAD dashboard, verified by a read-only baseline test.
- Edited JavaScript and both tour inline scripts parsed; edited edge TypeScript syntax parsed using TypeScript 5.9.3. This is not a full TypeScript check.
- `git diff --check` passed. No lint, web build or typecheck scripts exist in package.json. Native builds are outside this web-only change.
- Real browser/native visual QA is unavailable in this execution environment (no npx, Playwright CLI or browser runtime exposed). Interaction tests execute the actual UI functions with a DOM harness and the actual Supabase helper with a mocked transport; they are not live database or device tests. Before publication, verify normal and short phone layouts in light/dark mode, focus, back/skip and reopening on a native device.
- Existing offline-rating queuing is preserved; this patch does not add a queue replay mechanism or claim to have tested live offline sync.
