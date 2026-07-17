const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migrations = path.join(__dirname, '..', 'supabase', 'migrations');
const file = fs.readdirSync(migrations)
    .find(name => name.endsWith('_balance_support_job_queue.sql'));

assert.ok(file, 'support job queue migration should exist');

const sql = fs.readFileSync(path.join(migrations, file), 'utf8');

assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.balance_support_jobs/i);
assert.match(sql, /alert_id UUID NOT NULL UNIQUE REFERENCES public\.coach_alerts\(id\)/i);
assert.match(sql, /ALTER TABLE public\.balance_support_jobs ENABLE ROW LEVEL SECURITY/i);
assert.match(sql, /REVOKE ALL ON TABLE public\.balance_support_jobs FROM PUBLIC, anon, authenticated/i);
assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.balance_support_jobs TO service_role/i);
assert.match(sql, /CREATE OR REPLACE FUNCTION public\.refresh_balance_support_jobs/i);
assert.match(sql, /data ->> 'operator_queue' = 'support_operator'/i);
assert.match(sql, /CREATE OR REPLACE FUNCTION public\.claim_balance_support_jobs/i);
assert.match(sql, /FOR UPDATE SKIP LOCKED/i);
assert.match(sql, /CREATE OR REPLACE FUNCTION public\.complete_balance_support_job/i);
assert.match(sql, /q\.claim_token = p_claim_token/i);
assert.doesNotMatch(sql, /GRANT EXECUTE[\s\S]+TO (?:anon|authenticated)/i);

const hardeningFile = fs.readdirSync(migrations)
    .find(name => name.endsWith('_harden_operator_queue_receipts_and_founders_metrics.sql'));
assert.ok(hardeningFile, 'operator queue hardening migration should exist');
const hardeningSql = fs.readFileSync(path.join(migrations, hardeningFile), 'utf8');
assert.match(hardeningSql, /CREATE UNIQUE INDEX IF NOT EXISTS uq_balance_support_jobs_open_issue/i);
assert.match(hardeningSql, /PARTITION BY q\.support_issue_key/i);
assert.match(hardeningSql, /duplicate_support_job_reconciled/i);
assert.match(hardeningSql, /pg_advisory_xact_lock\(hashtext\('refresh_balance_support_jobs'\)\)/i);
assert.match(hardeningSql, /SELECT DISTINCT ON \(issue_key\)/i);

console.log('Balance support job queue migration checks passed');
