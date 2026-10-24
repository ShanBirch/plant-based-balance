// Local preparation only. The sole conversation operator submits the output to
// prepare_balance_free_coaching through the authenticated service connector.
const fs = require('node:fs');
const { buildFreeCoachingProgram, validateFreeCoachingProgram } = require('../netlify/functions/_lib/free-coaching-program');
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
async function main() {
    const program = validateFreeCoachingProgram(process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3],'utf8').replace(/^\uFEFF/,'')) : buildFreeCoachingProgram(input), input);
    const urls = [...new Set(program.weekly_schedule.flatMap(s => s.workout.exercises.map(e => e.video_url)))];
    for (const url of urls) {
        const response = await fetch(new URL(url, 'https://plantbased-balance.org'), { method:'HEAD', signal:AbortSignal.timeout(15000) });
        if (!response.ok || !/video|octet-stream/i.test(response.headers.get('content-type') || '')) throw Error('An exercise demo is unavailable; do not mark this setup ready.');
    }
    process.stdout.write(JSON.stringify(program));
}
main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode=1; });
