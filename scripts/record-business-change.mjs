import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(scriptDir, '..');

function parseArgs(argv) {
    const parsed = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) continue;
        const key = token.slice(2);
        const value = argv[index + 1];
        if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
        parsed[key] = value;
        index += 1;
    }
    if (!parsed.area || !parsed.summary) {
        throw new Error('Usage: npm run business:change -- --area <area> --summary <change> [--metric <expected metric>] [--commit <sha>]');
    }
    return parsed;
}

function loadSupabaseCredentials() {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return {
            url: process.env.SUPABASE_URL.replace(/\/+$/, ''),
            key: process.env.SUPABASE_SERVICE_ROLE_KEY,
        };
    }

    const netlifyScript = process.platform === 'win32' && process.env.APPDATA
        ? path.join(process.env.APPDATA, 'npm', 'node_modules', 'netlify-cli', 'bin', 'run.js')
        : null;
    const executable = netlifyScript && fs.existsSync(netlifyScript) ? process.execPath : 'netlify';
    const commandArgs = netlifyScript && fs.existsSync(netlifyScript)
        ? [netlifyScript, 'env:list', '--json']
        : ['env:list', '--json'];
    const canonicalWorkspace = 'C:\\Users\\shann\\.gemini\\antigravity\\plant_based_balance';
    const candidates = [workspace];
    if (process.platform === 'win32' && fs.existsSync(canonicalWorkspace) && path.resolve(workspace) !== path.resolve(canonicalWorkspace)) {
        candidates.push(canonicalWorkspace);
    }
    let lastError = '';
    for (const cwd of candidates) {
        const result = spawnSync(executable, commandArgs, {
            cwd,
            encoding: 'utf8',
            windowsHide: true,
            timeout: 30000,
        });
        if (result.status !== 0) {
            lastError = (result.stderr || result.error?.message || '').trim();
            continue;
        }
        try {
            const values = JSON.parse(result.stdout || '{}');
            if (values.SUPABASE_URL && values.SUPABASE_SERVICE_ROLE_KEY) {
                return {
                    url: values.SUPABASE_URL.replace(/\/+$/, ''),
                    key: values.SUPABASE_SERVICE_ROLE_KEY,
                };
            }
        } catch (error) {
            lastError = error.message;
        }
    }
    throw new Error(`Could not load Supabase credentials from Netlify${lastError ? `: ${lastError}` : ''}`);
}

function currentCommit() {
    const result = spawnSync('git', ['rev-parse', 'HEAD'], {
        cwd: workspace,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10000,
    });
    if (result.status !== 0) return '';
    return String(result.stdout || '').trim();
}

async function recordChange(args, credentials) {
    const response = await fetch(`${credentials.url}/rest/v1/rpc/record_balance_business_change`, {
        method: 'POST',
        headers: {
            apikey: credentials.key,
            Authorization: `Bearer ${credentials.key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            p_area: args.area,
            p_summary: args.summary,
            p_expected_metric: args.metric || null,
            p_commit_sha: args.commit || currentCommit() || null,
            p_status: args.status || 'shipped',
            p_source: args.source || 'codex',
            p_metadata: {},
        }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Business change RPC failed: ${response.status} ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : null;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const credentials = loadSupabaseCredentials();
    const row = await recordChange(args, credentials);
    process.stdout.write(`${JSON.stringify({
        recorded: true,
        id: row?.id || null,
        commit_sha: row?.commit_sha || null,
        area: row?.area || args.area,
        expected_metric: row?.expected_metric || args.metric || null,
    })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

export { parseArgs, recordChange };
