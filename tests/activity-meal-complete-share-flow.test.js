const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const studio = fs.readFileSync(path.join(root, 'js/dashboard/pbb-private-share-studio.js'), 'utf8');
const activity = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-10-points_widget_functions.js'), 'utf8');
const meals = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-11-calorie_tracker_functions.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

test('activity and meal logs open matching saved-summary pages', () => {
  assert.match(studio, /function renderActivityCompletePage\(data\)/);
  assert.match(studio, /function renderMealCompletePage\(meal\)/);
  assert.match(activity, /renderActivityCompletePage\?\.\(data\)/);
  assert.match(meals, /renderMealCompletePage\?\.\(meal\)/);
  assert.match(studio, /Share a photo/);
});

test('activity and meal photo actions enter the full-screen editor', () => {
  assert.match(activity, /function beginPrivateActivityPhotoShare\(\)/);
  assert.match(meals, /async function beginPrivateMealPhotoShare\(\)/);
  assert.match(activity, /context: 'activity'/);
  assert.match(meals, /context: 'meal'/);
  assert.match(studio, /existingPhotoLabel/);
});

test('finished editor image is used for both destinations', () => {
  assert.match(activity, /shareActivityCardToFeed\(studioShare\)/);
  assert.match(activity, /preparedDataUrl: studioShare\.renderedDataUrl/);
  assert.match(meals, /preparedDataUrl: studioShare\.renderedDataUrl/g);
  assert.match(studio, /studio_editor: editorState\(\)/);
  assert.match(studio, /async function captureExactEditorStage\(el\)/);
  assert.match(studio, /output = await captureExactEditorStage\(el\)/);
  assert.match(studio, /html2canvas@1\.4\.1/);
  assert.match(studio, /canvas\.width = 1080; canvas\.height = 1920/);
  assert.match(studio, /containScale = Math\.min/);
  assert.match(studio, /function scheduleInteractiveRender\(el\)/);
  assert.match(studio, /requestAnimationFrame\(function \(\)/);
  assert.match(studio, /active\.gestureActive/);
});

test('sharing keeps the editor open until Done', () => {
  const actionBody = studio.slice(studio.indexOf('async function runAction'), studio.indexOf('function bindElementLegacy'));
  assert.doesNotMatch(actionBody, /close\(\{ action: kind/);
  assert.match(actionBody, /Shared to Feed/);
  assert.match(actionBody, /IG Story opened/);
  assert.match(studio, /var doneCallback = active\.onDone/);
  assert.match(studio, /Promise\.resolve\(doneCallback\(\)\)/);
  assert.match(activity, /onDone: \(\) => closeSuccessScreen\(\)/g);
});

test('all members get both guided and returning-user discovery', () => {
  assert.match(dashboard, /title:'Activities and meals now match'/);
  assert.match(dashboard, /id: 'activity-meal-photo-share-all-members-v1'/);
});
