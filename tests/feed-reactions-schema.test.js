const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
    path.join(__dirname, '..', 'database', 'feed_reactions_migration.sql'),
    'utf8'
).toLowerCase();

[
    'create table if not exists public.feed_reactions',
    'references public.stories(id)',
    'references public.users(id)',
    'alter table public.feed_reactions enable row level security',
    'grant select on public.feed_reactions to authenticated',
    'grant insert, update, delete on public.feed_reactions to authenticated',
    'create or replace function public.get_story_reactions',
    'create or replace function public.toggle_feed_reaction',
    'security invoker',
    "auth.uid() <> p_user_id",
    'grant execute on function public.get_story_reactions(uuid) to authenticated',
    'grant execute on function public.toggle_feed_reaction(uuid, uuid, varchar) to authenticated'
].forEach(expected => {
    assert.ok(migration.includes(expected), `feed reactions migration should include ${expected}`);
});

assert.ok(
    !migration.includes('references auth.users(id)'),
    'feed reactions should reference the live public.users table, not auth.users'
);

console.log('feed reactions schema tests passed');
