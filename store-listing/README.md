# Balance store listing

This package repositions Balance around plant-based fitness, vegan nutrition and community. Gamification remains an optional supporting feature and is not used in the screenshot set.

## Store identity

- App name: `Balance: Plant-Based Fitness`
- App Store subtitle: `Training, meals & community`
- Google Play short description: `Vegan workouts, meal planning, progress tracking and community in one app.`

The full proposed listing copy is in `app-store/en-AU` and `google-play/en-AU`. The folders follow the Fastlane `deliver` and `supply` layout so the same approved package can be uploaded without rebuilding it by hand.

## Screenshot order

1. Plant-based community
2. Vegan meals and nutrition
3. Training direction
4. Health education
5. Weekly planning
6. Community progress feed

The source frames came from the July 18, 2026 real-app screen recording. Frames showing the optional character, eggs, yoghurt and other non-vegan feed meals were deliberately excluded.

Run `node scripts/generate-store-listing-assets.mjs` from the repository root to rebuild the branded exports.
