import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const migration = fs.readFileSync(fileURLToPath(new URL('../supabase/migrations/20261014070000_exact_story_claim_delivery.sql', import.meta.url)), 'utf8');
const fixture = fs.readFileSync(fileURLToPath(new URL('../supabase/tests/exact-story-claim-delivery.sql', import.meta.url)), 'utf8');
const boundary = fixture.indexOf('DO $test$');
if (boundary < 0) throw new Error('Missing isolated assertion block');
// Use the exact deployed bodies against session-local tables and surface stubs.
const functions = migration.slice(0, migration.indexOf('REVOKE ALL')).replaceAll('public.', 'pg_temp.');
process.stdout.write(fixture.slice(0, boundary) + functions + fixture.slice(boundary));
