import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const migration = fs.readFileSync(fileURLToPath(new URL('../supabase/migrations/20261014070000_exact_story_claim_delivery.sql', import.meta.url)), 'utf8');
const fixture = fs.readFileSync(fileURLToPath(new URL('../supabase/tests/exact-story-claim-delivery.sql', import.meta.url)), 'utf8');
const rejection = fs.readFileSync(fileURLToPath(new URL('../supabase/migrations/20261014080000_story_native_rejection_receipt.sql', import.meta.url)), 'utf8');
const boundary = fixture.indexOf('DO $test$');
if (boundary < 0) throw new Error('Missing isolated assertion block');
// Use the exact deployed bodies against session-local tables and surface stubs.
const functions = (migration.slice(0, migration.indexOf('REVOKE ALL')) + migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.claim_ig_next_actions')))
  .replaceAll('public.', 'pg_temp.').replaceAll('RETURNS SETOF ig_next_actions', 'RETURNS SETOF pg_temp.ig_next_actions');
const rejectionFunctions = rejection.slice(0, rejection.indexOf('REVOKE ALL')).replaceAll('public.', 'pg_temp.');
process.stdout.write(fixture.slice(0, boundary) + functions.trimEnd() + ';\n' + rejectionFunctions + fixture.slice(boundary));
