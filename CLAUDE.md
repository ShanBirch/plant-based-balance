# Project Notes

## Capacitor Web App

This is a Capacitor-based web app. The main UI lives in `dashboard.html` which is loaded remotely from Netlify.

## Important UI Patterns

### Status Bar / Safe Area

Every full-screen overlay view MUST include `env(safe-area-inset-top)` padding on its sticky header to avoid overlapping the system status bar (time, Wi-Fi, battery icons). Use this pattern:

```
padding-top: calc(15px + env(safe-area-inset-top, 0px));
```

This applies to any `<div>` with `position: sticky; top: 0;` that acts as a view header.

### Navigation: Swipe-Back Instead of Back Buttons

Do NOT add back buttons to view headers. The app uses swipe-back gesture navigation consistently. When creating a new full-screen view:

1. Use `pushNavigationState('view-id', closeHandler)` in the open function so the browser back button/gesture works.
2. Register the view in `initializeMovementSwipeNavigation()` with `enableSwipeBackNavigation('view-id', closeHandler)` so edge-swipe gestures work.
3. Keep the header clean with just the centered title — no back button.

### New Feature Announcements

When adding a new user-facing feature, you MUST add it to **both** of these systems:

1. **Feature Reveal** (`dashboard.html`, search for `NEW FEATURE REVEAL`): Add an entry to the `allFeatures` array with a unique `id`, `tab`, `sel` (CSS selector to spotlight), `title`, and `body`. This shows a celebration splash + spotlight walkthrough for returning users on their next app open. Uses `pbb_seen_features` in localStorage.

2. **Guided Feature Tour** (`dashboard.html`, search for `GUIDED FEATURE TOUR`): Add an entry to the `steps` array with `tab`, `sel`, `title`, and `body`. This is the onboarding tour for new users. Uses `featureTourComplete` in localStorage.

Both use the same format. Always add to both so new users AND existing users discover the feature.
