# Balance store listing

This package repositions Balance around plant-based fitness, vegan nutrition and community. Gamification remains an optional supporting feature and is not used in the screenshot set.

## Store identity

- App name: `Balance: Plant-Based Fitness`
- App Store subtitle: `Training, meals & community`
- Google Play short description: `Vegan workouts, meal planning, progress tracking and community in one app.`

The full proposed listing copy is in `app-store/en-AU` and `google-play/en-AU`. The folders follow the Fastlane `deliver` and `supply` layout so the same approved package can be uploaded without rebuilding it by hand.

## Screenshot order

1. Coach Shannon and real support
2. Coach-led six-week challenges
3. Vegan meal planning and nutrition
4. Training with direction
5. Plant-based community wins
6. Weekly planning and progress

The app frames came from the July 18, 2026 real-app screen recording. The coaching and training photography came from Shannon's supplied photo library. The challenge card came from Shannon's July 18 app screenshot, and the meal presentation uses the vegan sweet potato and black bean tacos already supplied with Balance. No faces were generated or altered.

Frames showing the optional character, eggs, yoghurt and other non-vegan feed meals were deliberately excluded. The feed member name and comments are redacted in the exported community images.

Run `node scripts/generate-store-listing-assets.mjs` from the repository root to rebuild the branded exports.
