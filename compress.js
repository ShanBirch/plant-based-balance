const fs = require('fs');
const https = require('https');
const path = require('path');
const { execSync } = require('child_process');

const urls = [
    "https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb",
    "https://f005.backblazeb2.com/file/shannonsvideos/level_1_good_final.glb",
    "https://f005.backblazeb2.com/file/shannonsvideos/level_10_real_final.glb",
    "https://f005.backblazeb2.com/file/shannonsvideos/level_20_real_final.glb",
    "https://f005.backblazeb2.com/file/shannonsvideos/level_30_real_final.glb",
    "https://f005.backblazeb2.com/file/shannonsvideos/level_40_real_final.glb",
    "https://f005.backblazeb2.com/file/shannonsvideos/level_50_real_final.glb",
    "https://f005.backblazeb2.com/file/shannonsvideos/level_1_female_final.glb",
    "https://f005.backblazeb2.com/file/shannonsvideos/level_10_female_final.glb",
    "https://f005.backblazeb2.com/file/shannonsvideos/level_20_female_final.glb",
    "https://f005.backblazeb2.com/file/shannonsvideos/level_30_female_final.glb",
    "https://f005.backblazeb2.com/file/shannonsvideos/level_40_female_final.glb",
    "https://f005.backblazeb2.com/file/shannonsvideos/level_50_female_final.glb"
];

const downloadFolder = path.join(__dirname, 'raw_characters');
const compressFolder = path.join(__dirname, 'compressed_main_characters');

if (!fs.existsSync(downloadFolder)) fs.mkdirSync(downloadFolder);
if (!fs.existsSync(compressFolder)) fs.mkdirSync(compressFolder);

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
            resolve();
            return;
        }
        console.log(`Downloading ${path.basename(dest)}...`);
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

function getFileSizeMB(filePath) {
    const stats = fs.statSync(filePath);
    return (stats.size / (1024 * 1024)).toFixed(2);
}

async function run() {
    for (const url of [...new Set(urls)]) {
        const fileName = path.basename(url);
        const rawPath = path.join(downloadFolder, fileName);
        const compressPath = path.join(compressFolder, fileName);
        
        try {
            await downloadFile(url, rawPath);
            const rawSize = getFileSizeMB(rawPath);
            console.log(`\n[${fileName}] Downloaded. Raw Size: ${rawSize} MB`);
            
            if (fs.existsSync(compressPath)) {
                console.log(`[${fileName}] Compressed file already exists. Size: ${getFileSizeMB(compressPath)} MB`);
                continue;
            }

            console.log(`[${fileName}] Compressing with gltf-transform draco...`);
            const cmd = `cmd.exe /c npx -y @gltf-transform/cli@latest draco "${rawPath}" "${compressPath}"`;
            execSync(cmd, { stdio: 'inherit' });
            
            const compressedSize = getFileSizeMB(compressPath);
            console.log(`[${fileName}] Compression Complete. Compressed Size: ${compressedSize} MB`);
            
        } catch (e) {
            console.error(`Error processing ${fileName}:`, e.message);
        }
    }
    console.log('\nAll done!');
}

run();
