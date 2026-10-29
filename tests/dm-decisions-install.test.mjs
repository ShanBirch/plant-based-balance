import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { installReview } from '../scripts/install-dm-decisions-review.mjs';

test('installer is bounded, idempotent and adds persisted review to the existing helper', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'balance-decisions-install-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const original = `import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const continuityPolicy = {version:'fixture'};
const literal = text => "'" + text.replaceAll("'", "''") + "'";
export function fastReplyContext() { return \`SELECT jsonb_build_object(
        'conversation_continuity_policy', \${literal(JSON.stringify(continuityPolicy))}::jsonb,
        'fixture', true);\`; }
export function fastReplyClaim(input) { return JSON.stringify({
        conversation_policy_version: continuityPolicy.version,
        claim: 'unchanged-fixture'}); }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [operation, inputPath] = process.argv.slice(2);
    const input = JSON.parse(await fs.readFile(inputPath, 'utf8'));
    process.stdout.write(operation === 'context' ? fastReplyContext(input) : fastReplyClaim(input));
}
`;
    await fs.writeFile(path.join(dir,'balance-dm-fast-reply.mjs'),original);
    await assert.rejects(installReview({ runtimeDir: dir, envFile: path.join(dir,'.env.local') }), /Live synthetic/);
    const first = await installReview({ runtimeDir: dir, envFile: path.join(dir,'.env.local'), liveVerified: true });
    assert.equal(first.helperPatched, true);
    const second = await installReview({ runtimeDir: dir, envFile: path.join(dir,'.env.local'), liveVerified: true });
    assert.equal(second.helperPatched, false);
    assert.equal(await fs.readFile(path.join(dir,'daily-conversation-learning/backups/decisions-20261029/balance-dm-fast-reply.mjs'),'utf8'),original);
    const installed = await import(pathToFileURL(path.join(dir,'balance-dm-fast-reply.mjs')));
    assert.match(installed.fastReplyContext(), /decisions_review_policy/);
    const sql = JSON.parse(installed.fastReplyClaim({}));
    assert.equal(sql.claim,'unchanged-fixture');
    assert.equal(sql.decisions_review.reason,'direct_call_without_api_review');
    const config = JSON.parse(await fs.readFile(path.join(dir,'decisions-review-config.json'),'utf8'));
    assert.equal(config.enabled,true);
    assert.equal(config.mode,'advisory');
});
