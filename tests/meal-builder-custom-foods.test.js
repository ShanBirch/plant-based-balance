const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-meal-builder.js'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'css/dashboard/pbb-premium-overlays.css'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260901085731_add_user_custom_foods.sql'), 'utf8');

test('members can save a complete custom food and choose whether it is shared', () => {
  assert.match(dashboard, /id="meal-builder-custom-name"/);
  assert.match(dashboard, /id="meal-builder-custom-weight"/);
  assert.match(dashboard, /id="meal-builder-custom-calories"/);
  assert.match(dashboard, /id="meal-builder-custom-protein"/);
  assert.match(dashboard, /id="meal-builder-custom-carbs"/);
  assert.match(dashboard, /id="meal-builder-custom-fat"/);
  assert.match(dashboard, /id="meal-builder-custom-fiber"/);
  assert.match(dashboard, /id="meal-builder-custom-shared" type="checkbox" checked/);
  assert.match(dashboard, /Your name is never shown/);
  assert.match(builder, /window\.saveBuilderCustomFood = async function/);
  assert.match(builder, /\.from\('user_custom_foods'\)[\s\S]*?\.insert\(row\)/);
});

test('My Foods persist per account and community foods appear in ingredient search', () => {
  assert.match(dashboard, /onclick="openBuilderMyFoods\(\)"/);
  assert.match(builder, /\.eq\('user_id', userId\)/);
  assert.match(builder, /\.eq\('is_shared', true\)/);
  assert.match(builder, /searchSharedBuilderFoods\(query\)/);
  assert.match(builder, /balance-community-food/);
  assert.match(builder, /customFoodRowToSearchFood/);
});

test('custom-food controls remain readable in both Balance themes', () => {
  assert.match(theme, /\.meal-builder-custom-input/);
  assert.match(theme, /\.meal-builder-custom-share/);
  assert.match(theme, /html\[data-pbb-theme="light"\] \.meal-builder-custom-input/);
  assert.match(theme, /html\[data-pbb-theme="light"\] \.meal-builder-custom-share strong/);
  assert.match(theme, /html\[data-pbb-theme="light"\] \.meal-builder-my-food-item/);
});

test('custom-food storage is authenticated, owner-controlled, and community-readable only when shared', () => {
  assert.match(migration, /create table if not exists public\.user_custom_foods/);
  assert.match(migration, /alter table public\.user_custom_foods enable row level security/);
  assert.match(migration, /revoke all on table public\.user_custom_foods from anon/);
  assert.match(migration, /grant select, insert, update, delete on table public\.user_custom_foods to authenticated/);
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id or is_shared = true\)/);
  assert.match(migration, /with check \(\(select auth\.uid\(\)\) = user_id\)/);
});
