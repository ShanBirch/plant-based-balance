import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The installed organic operator uses this policy-complete source. The older
// root helper is retained for compatibility, not as an installation source.
const modulePath = fileURLToPath(new URL('./instagram-dm/review-dm-decisions.mjs', import.meta.url));
const marker = '// Decisions review integration 20261029';

export async function installReview({ runtimeDir, envFile, liveVerified = false }) {
    if (!liveVerified) throw new Error('Live synthetic verification required before activation');
    const helperPath = path.join(runtimeDir, 'balance-dm-fast-reply.mjs');
    const original = await fs.readFile(helperPath, 'utf8');
    let updated = original;
    if (!original.includes(marker)) {
        const contextAnchor = "        'conversation_continuity_policy', ${literal(JSON.stringify(continuityPolicy))}::jsonb,";
        const reasonAnchor = '        conversation_policy_version: continuityPolicy.version,';
        const outputAnchor = "    process.stdout.write(operation === 'context' ? fastReplyContext(input) : fastReplyClaim(input));";
        if (![contextAnchor,reasonAnchor,outputAnchor].every(anchor => original.includes(anchor))) {
            throw new Error('Installed helper changed; inspect it before applying integration');
        }
        updated = `${marker}\nimport { createHash } from 'node:crypto';\nimport { reviewClaim, reviewPolicy, validateClaimReview } from './review-dm-decisions.mjs';\n${original}`;
        updated = updated.replace(contextAnchor, `${contextAnchor}\n        'decisions_review_policy', ${'${literal(JSON.stringify(reviewPolicy))}'}::jsonb,`);
        updated = updated.replace(reasonAnchor, `${reasonAnchor}\n        decisions_review: validateClaimReview(input),`);
        updated = updated.replace(outputAnchor, `    let reviewedInput = input;
    if (operation === 'claim' && input.conversationReview?.lane === 'organic_business') {
        const config = JSON.parse(await fs.readFile(new URL('./decisions-review-config.json', import.meta.url), 'utf8'));
        if (config.enabled) {
            try { process.loadEnvFile(config.envFile); } catch { /* Ordinary review remains available. */ }
            const learnedRules = await fs.readFile(new URL('./daily-conversation-learning/learned-rules.md', import.meta.url), 'utf8');
            const policy = JSON.stringify({ continuityPolicy, learnedRules });
            reviewedInput = await reviewClaim(input, {
                currentPolicy: policy, learningRevision: config.version + ':' + createHash('sha256').update(policy).digest('hex'),
                apiKey: process.env.OPENAI_API_KEY,
                recordReview: async report => {
                    const file = new URL('./daily-conversation-learning/decisions-reviews/' + report.reviewId + '.json', import.meta.url);
                    await fs.mkdir(new URL('.',file), { recursive: true });
                    await fs.writeFile(file, JSON.stringify(report) + '\\n', { mode: 0o600, flag: 'wx' });
                }
            });
        }
    }
    process.stdout.write(operation === 'context' ? fastReplyContext(input) : fastReplyClaim(reviewedInput));`);
        const backupDir = path.join(runtimeDir, 'daily-conversation-learning/backups/decisions-20261029');
        await fs.mkdir(backupDir, { recursive: true });
        await fs.writeFile(path.join(backupDir, 'balance-dm-fast-reply.mjs'), original, { flag: 'wx' });
    }
    if (!updated.includes("'latest_inbound',")) {
        const anchor = "        'actions', (select jsonb_agg(to_jsonb(action)) from ig_next_actions action where thread_id=${uuid(threadId)}),";
        if (!updated.includes(anchor)) throw new Error('Compaction context changed; inspect before adding inbound evidence');
        updated = updated.replace(anchor, `        'latest_inbound', (select jsonb_build_object('id',id,'direction',direction,'text',text,'created_at',created_at)
            from history where direction='in' and event_key like 'ig:%' order by created_at desc,id desc limit 1),
${anchor}`);
    }
    const code = await fs.readFile(modulePath);
    const codeHash = createHash('sha256').update(code).digest('hex');
    await fs.copyFile(modulePath, path.join(runtimeDir, 'review-dm-decisions.mjs'));
    await fs.writeFile(path.join(runtimeDir, 'decisions-review-config.json'), JSON.stringify({
        enabled: true, mode: 'advisory', version: 'dm_decisions_review_20261029_v1',
        policyHash: codeHash, envFile: path.resolve(envFile), liveSyntheticVerified: true
    }, null, 2) + '\n');
    if (updated !== original) {
        const temporary = helperPath + '.decisions.tmp';
        await fs.writeFile(temporary, updated);
        await fs.rename(temporary, helperPath);
    }
    return { installed: true, runtimeDir, codeHash, helperPatched: updated !== original };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [runtimeDir,envFile,verified] = process.argv.slice(2);
    installReview({ runtimeDir, envFile, liveVerified: verified === '--live-verified' })
        .then(result => process.stdout.write(JSON.stringify(result) + '\n'))
        .catch(() => { process.stderr.write('Review installation failed; inspect the installed helper and saved backup.\n'); process.exitCode = 1; });
}
