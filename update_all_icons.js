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

    // 1. Update Android Icons
    for (const icon of icons) {
        const outPath = path.join(androidResDir, icon.dir, 'ic_launcher.png');
        const outPathRound = path.join(androidResDir, icon.dir, 'ic_launcher_round.png');
        
        // Ensure directories exist (though they should)
        if (!fs.existsSync(path.join(androidResDir, icon.dir))) {
            fs.mkdirSync(path.join(androidResDir, icon.dir), { recursive: true });
        }

        // Square icon
        await sharp(source)
            .resize(icon.size, icon.size)
            .png()
            .toFile(outPath);
        
        // Round icon (using sharp to mask it circular if possible, or just square for now)
        // For Android, usually you want a round mask if it's "ic_launcher_round"
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

        console.log(`Updated ${icon.dir} icons (${icon.size}x${icon.size})`);
    }

    // 2. Update common web assets
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
