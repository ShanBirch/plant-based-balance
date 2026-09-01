const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const nextSteps = fs.readFileSync(path.join(root, 'js/dashboard/pbb-next-obvious-steps.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const movement = dashboard.match(/<div id="movement-tab"[\s\S]*?<!-- Persistent custom exercise video upload progress -->/)?.[0] || '';

test('Movement Studio has one heading and no redundant pre-workout action cards', () => {
  assert.match(movement, /<div class="app-logo">Movement Studio<\/div>/);
  assert.doesNotMatch(movement, /<h1[^>]*>Movement<\/h1>/);
  assert.doesNotMatch(movement, /id="form-check-quick-card"/);
  assert.doesNotMatch(movement, /id="movement-add-exercise-btn"/);
  assert.match(movement, /id="movement-grid-container"/);
});

test('Form Check and Add an Exercise remain available inside workouts', () => {
  assert.match(dashboard, /id="workout-form-check-top-btn"[\s\S]*Film Form Check/);
  assert.match(dashboard, /id="workout-add-exercise-video-btn"[\s\S]*Add an Exercise/);
  assert.doesNotMatch(dashboard, /sel: '#form-check-quick-card'|sel:'#movement-add-exercise-btn'/);
  assert.doesNotMatch(nextSteps, /#form-check-quick-card/);
});

test('returning phones receive the Movement cleanup', () => {
  assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v453-meal-builder-search'/);
});
