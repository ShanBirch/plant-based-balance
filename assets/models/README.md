# Website character

`balance-web-greet-v2.glb` is the website-only version of Shannon's `baby_full_animations.glb` from the shannonsvideos bucket.

- Original: 22,881,752 bytes. Website: 4,095,600 bytes (82% smaller).
- Preserves all four original meshes and their triangle counts, textures, rig, greeting and idle animations.
- Removes unused animation channels and samplers; Draco compression uses position 16, normal 12, UV 14 and generic 16-bit precision.
- No mesh simplification: it introduced visible surface cracks and was discarded.
- Produced with glTF Transform 4.5.0 and draco3dgltf 1.5.7. Decoded output checked against original mesh triangle counts and inspected in the live Three.js renderer.
- Use the same versioned URL for preload and loading, with `cacheBustModel: false`, so repeat visits reuse the downloaded model.
