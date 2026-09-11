# Phone button alignment — 11 September 2026

- Workout options: replace the font-based ellipsis with three symmetric SVG circles.
  Reset padding, appearance and text spacing; preserve the existing themed surface,
  border, button dimensions, accessible name, expanded state and menu handlers.
- Feed composer: centre Post with flex layout, prevent label shrink/wrap, allow the
  actions row to wrap instead of overflowing, and include textarea padding in width.
- Feed comments: allow the input to shrink to the available space; keep the Post
  control at least 44px and inside the row. No posting handlers were changed.

Verification: 14 focused tests pass. Browser fixture uses the actual workout player,
dashboard composer markup/styles and existing theme styles. Screenshots captured in
the task at 320x568, keyboard-sized 320x300 and landscape 667x375; light/dark, zero
inset and simulated 59px top/34px bottom. Workout icon centre offset measured 0px on
both axes before and after scroll/reopen. Menu opens and Escape closes it. Composer
and comment Post clicks verified with test-only handlers (no real posts sent).
At 320px, composer Post right edge is 277px inside a card ending at 289.8px; comment
Post right edge is 263px. Long comments remain within the input. Physical iPhone
Safari/WebView confirmation remains a device-side check.
