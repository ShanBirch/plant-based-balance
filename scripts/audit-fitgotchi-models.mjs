// Read-only live asset check: node scripts/audit-fitgotchi-models.mjs
// A mismatch needs visual review, not an automatic renaming of the baseline.
import fs from 'node:fs';
const fixture = JSON.parse(fs.readFileSync(new URL('../tests/fixtures/fitgotchi-clips.json', import.meta.url)));
const jobs = fixture.groups.flatMap(group => group.files.map(file => ({ file, expected: group.clips })));
let cursor = 0;
const failures = [];

async function readRange(url, end) {
    const response = await fetch(url, { headers: { Range: `bytes=0-${end}` }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
}

async function worker() {
    while (cursor < jobs.length) {
        const { file, expected } = jobs[cursor++];
        try {
            const url = fixture.source + file;
            let data = await readRange(url, 2097151);
            if (data.toString('ascii', 0, 4) !== 'glTF') throw new Error('Not a GLB');
            const length = data.readUInt32LE(12);
            if (length > 16000000) throw new Error('Unexpectedly large GLB header');
            if (data.length < 20 + length) data = await readRange(url, 19 + length);
            const gltf = JSON.parse(data.subarray(20, 20 + length).toString());
            const actual = (gltf.animations || []).map(animation => [
                animation.name,
                Number(Math.max(...animation.samplers.map(s => gltf.accessors[s.input].max?.[0] || 0)).toFixed(3))
            ]).sort();
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                failures.push(file + ': clip names/durations changed; review the movements and mappings');
            }
        } catch (error) {
            failures.push(file + ': ' + error.message);
        }
    }
}

await Promise.all(Array.from({ length: 4 }, worker));
for (const failure of failures) console.error(failure);
console.log(`${jobs.length - failures.length}/${jobs.length} character inventories match the reviewed baseline.`);
if (failures.length) process.exitCode = 1;
