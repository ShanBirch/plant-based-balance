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
