#!/usr/bin/env node
/**
 * Run the Balance DM Sparring Gym.
 *
 * Examples:
 *   node scripts/run-dm-sparring-gym.js --count=5 --turns=4
 *   node scripts/run-dm-sparring-gym.js --persona=body_image_lurker --count=1
 *   node scripts/run-dm-sparring-gym.js --offline --count=2
 *
 * Required for live AI mode:
 *   GEMINI_API_KEY
 *
 * Optional for Shannon fine-tuned voice:
 *   FIREBASE_SERVICE_ACCOUNT
 *   or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY + FIREBASE_PROJECT_ID
 */

const fs = require('fs/promises');
const path = require('path');

const {
    DEFAULT_PERSONAS,
    runSparringBatch,
    renderMarkdownReport,
} = require('../netlify/functions/_lib/dm-sparring-gym');

const COLORS = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m',
};

function parseArgs(argv = process.argv.slice(2)) {
    const args = {
        count: 3,
        turns: 4,
        seed: new Date().toISOString().slice(0, 10),
        personaKeys: [],
        outputDir: path.join(process.cwd(), 'artifacts', 'dm-sparring'),
        coachModel: 'auto',
        qualifierEnabled: true,
        storyBots: true,
        offline: false,
        listPersonas: false,
    };

    for (const arg of argv) {
        if (arg === '--offline') args.offline = true;
        else if (arg === '--no-qualifier') args.qualifierEnabled = false;
        else if (arg === '--no-story-bots') args.storyBots = false;
        else if (arg === '--list-personas') args.listPersonas = true;
        else if (arg.startsWith('--count=')) args.count = Math.max(1, Number(arg.slice('--count='.length)) || args.count);
        else if (arg.startsWith('--turns=')) args.turns = Math.max(1, Number(arg.slice('--turns='.length)) || args.turns);
        else if (arg.startsWith('--seed=')) args.seed = arg.slice('--seed='.length) || args.seed;
        else if (arg.startsWith('--persona=')) args.personaKeys.push(arg.slice('--persona='.length));
        else if (arg.startsWith('--output=')) args.outputDir = path.resolve(arg.slice('--output='.length));
        else if (arg.startsWith('--coach-model=')) {
            const value = arg.slice('--coach-model='.length);
            if (['auto', 'vertex', 'gemini'].includes(value)) args.coachModel = value;
        }
    }

    return args;
}

function ensureLiveAiReady(args) {
    if (args.offline) return;
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is required for live sparring. Re-run with --offline for a no-network smoke test.');
    }
}

function printPersonaList() {
    console.log('\nAvailable personas:\n');
    for (const persona of DEFAULT_PERSONAS) {
        console.log(`- ${persona.key}: ${persona.name}, ${persona.route}`);
    }
    console.log('');
}

function timestampSlug() {
    return new Date().toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .replace('Z', 'Z');
}

async function writeReports(batch, outputDir) {
    await fs.mkdir(outputDir, { recursive: true });
    const slug = `${timestampSlug()}_${batch.count}x${batch.turns}_${batch.seed.replace(/[^a-z0-9_-]+/gi, '-')}`;
    const jsonPath = path.join(outputDir, `${slug}.json`);
    const mdPath = path.join(outputDir, `${slug}.md`);
    await fs.writeFile(jsonPath, JSON.stringify(batch, null, 2), 'utf8');
    await fs.writeFile(mdPath, renderMarkdownReport(batch), 'utf8');
    return { jsonPath, mdPath };
}

function printSummary(batch, paths) {
    const risks = Object.entries(batch.summary.risk_counts || {})
        .sort((a, b) => b[1] - a[1])
        .map(([risk, count]) => `${risk}:${count}`)
        .join(', ') || 'none';

    console.log(`\n${COLORS.cyan}${COLORS.bold}DM Sparring Gym complete${COLORS.reset}`);
    console.log(`${COLORS.green}overall${COLORS.reset}: ${batch.summary.averages.overall}/10`);
    console.log(`${COLORS.green}likely reply${COLORS.reset}: ${batch.summary.averages.likely_reply}/10`);
    console.log(`${COLORS.green}likely join${COLORS.reset}: ${batch.summary.averages.likely_join}/10`);
    console.log(`${COLORS.yellow}risks${COLORS.reset}: ${risks}`);
    console.log(`\nReports:`);
    console.log(`- ${paths.mdPath}`);
    console.log(`- ${paths.jsonPath}`);
}

async function main() {
    const args = parseArgs();
    if (args.listPersonas) {
        printPersonaList();
        return;
    }

    const unknownPersonas = args.personaKeys.filter(
        key => !DEFAULT_PERSONAS.some(persona => persona.key === key)
    );
    if (unknownPersonas.length) {
        throw new Error(`Unknown persona(s): ${unknownPersonas.join(', ')}. Use --list-personas.`);
    }

    ensureLiveAiReady(args);

    console.log(`${COLORS.cyan}Running DM sparring:${COLORS.reset} count=${args.count}, turns=${args.turns}, seed=${args.seed}, coach=${args.coachModel}, qualifier=${args.qualifierEnabled ? 'on' : 'off'}, storyBots=${args.storyBots ? 'on' : 'off'}, offline=${args.offline ? 'yes' : 'no'}`);
    const batch = await runSparringBatch(args);
    const paths = await writeReports(batch, args.outputDir);
    printSummary(batch, paths);
}

main().catch(err => {
    console.error(`${COLORS.red}DM sparring failed:${COLORS.reset} ${err.message}`);
    process.exitCode = 1;
});
