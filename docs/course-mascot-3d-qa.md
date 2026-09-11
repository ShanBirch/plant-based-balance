# Original 3D course mascot — 11 September 2026

## Change

Restore the original animated Shanbot, not a replacement vector character. The
original iOS path skipped its model and replaced the viewer with a div placeholder;
native iOS also skipped the model-viewer library. The new course-only controller
restores that placeholder, requests the library on demand, prepares the model on
course entry, pauses on close, reuses it on reopen, and offers tap-to-retry on error.
Safe boot remains respected unless the member explicitly taps to load the model.

The course asset is derived from the existing public `shanbot_final.glb`. Original:
19,422,504 bytes, 1,910,286 triangles. Course copy: approximately 1.38 MB, 91,876
triangles. Same character, original texture, rig, and dance animation. Reduced
geometry detail is limited to this 70px companion; no Home character is changed.

Reproduce using `scripts/build-course-mascot.cjs original.glb course-stage.glb`,
then glTF Transform CLI 4.2.1: `simplify --ratio 0.015 --error 0.001`, then `draco`.
The build script only strips unused animations/buffers; simplification/compression
is the second stage. Texture resizing was not applied. CLI reference:
https://gltf-transform.dev/cli

## Verification

- 30 focused runtime/regression tests pass, covering restored viewers on iOS and
  desktop, library-missing native boot, load failure/retry, safe boot, reuse,
  onboarding keyboard coverage, scroll lock restoration, tour-banner clearance,
  exercise metadata-to-thumbnail seeking, and prior tour placement checks.
- Separate FitGotchi visibility regression passes.
- GLB validator: no errors. Existing skinned-mesh-parent warning; Draco payload
  validated by actual browser decoding/rendering rather than the validator.
- Browser fixture extracts the production markup, controller, LearningMascot and
  iOS placeholder-restoration function (not a substitute renderer). Real 3D model
  loaded and danced, with iOS/native flags and an initial div placeholder.
- First local browser load 2.9s including renderer/decoder; cached reopen/navigation
  0.4s. These are desktop-browser measurements, not promised iPhone timings.
- Visual screenshots captured in the task at 320x568 and 667x375, both themes,
  zero inset and simulated 59px top / 34px bottom inset. Closing/reopening and
  scrolling retain the model. Minimum observed clearance above navigation: 20px;
  landscape speech top 92px, below the 59px status region.
- Physical iPhone keyboard/WebGL memory behavior still requires device confirmation.
  Earlier keyboard/video browser evidence is in `iphone-onboarding-keyboard-qa.md`.

Ship together with the preceding keyboard, workout tour and video-thumbnail fixes.
