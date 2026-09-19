# Character startup failure repair, 19 September 2026

## Evidence and cause

A member reported slow startup and two crashes before the app opened. Fresh production reads found four client-error events during 14–19 September: two ReferenceErrors at `dashboard-script-15.js?v=9:529`, a RangeError at line 69, and an unhandled-promise RangeError in the same session. These are JavaScript exceptions, not native crash reports.

The rare/evolution script registers its local colour-policy fallback on `window`. Before the deferred battle script installs its policy, that fallback calls itself indefinitely. iOS loads the scripts through separate deferred paths, making this ordering possible. The model-load callbacks also refer to that local helper from outside its IIFE, producing a ReferenceError and interrupting animation/completion callbacks.

Both failures were reproduced using the complete unmodified script, first in Node and then in a headless Edge browser with an iPhone user agent and an actual DOM model-load event. The browser model element is a test double; this does not simulate WebGL, SceneKit or iOS process memory.

## Change

- Do not delegate the fallback policy to itself.
- Resolve the shared policy through `window` in both model-load callbacks.
- Bump both dashboard script URLs to `v=10-startup-colour-policy`.

No native code, account data, tour UI, material allowlists, coaching or program changes are included.

## Verification

Seven focused regression cases cover early/repeated calls, deferred policy replacement, battle-first ordering, iPhone hot-swap completion, desktop evolution selection, rare texture protection, and native handoff. Existing startup-shell, iOS script loader and account-tour exemption tests are also included.

Browser before/after: old script throws RangeError and ReferenceError, never reaching animation/completion; patched script completes colour application, animation and completion exactly once with no page errors. Local detailed output is in ignored `output/nat-startup/browser-results.json`.

The established member's account was created in April and has completed onboarding. Existing production tour suppression discards stale tour checkpoints for established members; its regression tests pass. Live telemetry shows eight guided-tour starts on 15 September and none after that date through this investigation. This does not prove the earlier chat-overlay complaint is client-confirmed resolved. That support issue remains separate.

## Limits and measurement

We cannot reproduce or rule out a native iPhone process termination without the device or an iOS crash report. The existing rapid-relaunch guard enables safe boot on a third unclean open, but that is a heuristic, not proof of why a prior open ended. Do not describe these JavaScript repairs as a verified cure for every reported native crash. No client message is authorized in this task.

Hypothesis: eliminating these two character-policy exceptions allows model startup callbacks to finish regardless of deferred script ordering. Variant: `startup-colour-policy-v10`. Primary diagnostic: client errors in script 15 (RangeError and ReferenceError) on the new version. Secondary signals: successful page views/usage after launch and member confirmation. Guardrail: ordinary/rare appearance and native model handoff remain unchanged. Review date: 22 September 2026 or the member's next startup report; no scheduled outreach is created.
