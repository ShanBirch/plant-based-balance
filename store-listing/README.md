# Balance store listing

This package repositions Balance as **Neuroscience for Real-Life Fitness**: practical neuroscience and behaviour science brought to life through personalised training, nutrition, weekly goals, coaching and community.

## Store identity

- App name: `Balance: Neuroscience Fitness`
- Brand line: `Neuroscience for Real-Life Fitness`
- App Store subtitle: `Fitness, nutrition & habits`
- Google Play short description: `Neuroscience-informed fitness, nutrition and habits built for real life.`

Vegan and plant-based preferences remain supported inside personalised nutrition, but they are not the identity of the app.

The full proposed listing copy is in `app-store/en-AU` and `google-play/en-AU`. The folders follow the Fastlane `deliver` and `supply` layout so the same approved package can be uploaded without rebuilding it by hand.

## Screenshot order

1. Neuroscience for real-life fitness
2. Understand why change feels hard
3. Training with direction
4. Personalised nutrition
5. Weekly planning and progress
6. Real community momentum

The app frames came from real Balance screens. Coaching and training photography is Shannon's supplied photography. Community images are approved Balance proof assets with identifying feed details redacted. The nutrition background uses the existing chickpea "tuna" wrap image. No generated people are used.

The feed member name and comments are redacted in the exported community images.

Run `node scripts/generate-store-listing-assets.mjs` from the repository root to rebuild the branded exports.
