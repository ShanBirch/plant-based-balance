# iPhone setup and workout-tour layout — 11 September 2026

## Changes

- Lock and restore the background document while setup is open. A separate full-height curtain covers Home while the inner card follows the visual viewport, including iOS pan offsets.
- Coalesce viewport events; only reset the question scroll when entering keyboard mode, not on every keyboard pan.
- Reserve status-bar space even when a WebView reports zero safe insets. Apply the compact layout in phone landscape too; long content can scroll, and narrow inputs cannot push Send outside the card.
- Measure the Unlock Balance banner's actual bottom edge. Keep the workout viewport below it and clip/hide the tour spotlight when its arrow scrolls away. Restore normal workout layout when leaving the tour.
- Request an initial exercise video frame and seek at HAVE_METADATA rather than waiting for decoded data before starting the seek. Existing image posters remain supported.

## Verification

Local browser QA used production styles and extracted production positioning/thumbnail functions, with isolated sample questions (no account writes). Screenshots were inspected in the Codex thread.

- 320×568 and 375×667 portrait; 667×375 landscape.
- Light and dark app selectors; the setup surface intentionally remains branded cream/gold with explicit dark ink in both themes.
- Simulated zero and 59px top / 34px bottom safe insets; keyboard-sized viewports; age, height, weight, and long goal prompts; forward/back and close/reopen.
- Keyboard-resized landscape: input and Send reachable through the inner scroller/focus navigation.
- Wrapped banner, exercise next/back, scrolling away and returning, and rotation: no arrow spotlight over the banner.
- Exercise first-frame preview reached readyState 4 at 0.35 seconds without a playback tap.
- Node regression tests exercise iOS-style visual viewport pan offsets, very short keyboard viewports, repeated resize events, scroll-lock restoration, banner height, and metadata-only video priming.

This is desktop browser simulation, not a physical iPhone or WKWebView test. Native keyboard animation and low-power/data-saving video preload restrictions still require a device retest after updating. No claim of a complete fresh-account-to-payment click-through is made by this focused patch.
