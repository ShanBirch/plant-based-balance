const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const source = 'assets/balance_logo.png';
const androidResDir = 'android/app/src/main/res';

const icons = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 }
];

async function updateIcons() {
    if (!fs.existsSync(source)) {
        console.error('Source not found:', source);
        return;
    }

    // 1. Update Android Icons (square, round, and foreground)
    for (const icon of icons) {
        const outPath = path.join(androidResDir, icon.dir, 'ic_launcher.png');
        const outPathRound = path.join(androidResDir, icon.dir, 'ic_launcher_round.png');
        const outPathFg = path.join(androidResDir, icon.dir, 'ic_launcher_foreground.png');

        if (!fs.existsSync(path.join(androidResDir, icon.dir))) {
            fs.mkdirSync(path.join(androidResDir, icon.dir), { recursive: true });
        }

        // Square icon
        await sharp(source)
            .resize(icon.size, icon.size)
            .png()
            .toFile(outPath);

        // Round icon with circular mask
        const radius = icon.size / 2;
        const circleShape = Buffer.from(
            `<svg><circle cx="${radius}" cy="${radius}" r="${radius}" /></svg>`
        );

        await sharp(source)
            .resize(icon.size, icon.size)
            .composite([{
                input: circleShape,
                blend: 'dest-in'
            }])
            .png()
            .toFile(outPathRound);

        // Foreground icon (used by adaptive icons on Android 8+)
        // Scaled to ~66% so it fits within the safe zone of the adaptive icon
        const fgSize = Math.round(icon.size * 1.5); // canvas is 1.5x the icon size
        const logoSize = icon.size;
        const offset = Math.round((fgSize - logoSize) / 2);
        await sharp(source)
            .resize(logoSize, logoSize)
            .extend({
                top: offset,
                bottom: fgSize - logoSize - offset,
                left: offset,
                right: fgSize - logoSize - offset,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .png()
            .toFile(outPathFg);

        console.log(`Updated ${icon.dir} icons (${icon.size}x${icon.size})`);
    }

    // 2. Update iOS App Icon (1024x1024)
    const iosIconPath = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png';
    await sharp(source)
        .resize(1024, 1024)
        .png()
        .toFile(iosIconPath);
    console.log(`Updated iOS icon (1024x1024)`);

    // 3. Update common web assets
    const webAssets = [
        { file: 'assets/logo.png', size: 512 },
        { file: 'assets/logo_optimized.png', size: 512 },
        { file: 'assets/logo_full.png', size: 1024 },
        { file: 'assets/logo_yinyang_192.png', size: 192 },
        { file: 'assets/logo_yinyang_512.png', size: 512 },
        { file: 'assets/logo_homescreen.png', size: 192 },
        { file: 'assets/logo_pbb.png', size: 512 },
        { file: 'assets/logo_yinyang_small.png', size: 64 },
        { file: 'assets/pbb_logo_final.png', size: 512 }
    ];

    for (const asset of webAssets) {
        await sharp(source)
            .resize(asset.size, asset.size)
            .png()
            .toFile(asset.file);
        console.log(`Updated ${asset.file} (${asset.size}x${asset.size})`);
    }

    console.log('All icons updated successfully!');
}

updateIcons().catch(err => {
    console.error('Error updating icons:', err);
    process.exit(1);
});
