const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const dashboard = fs.readFileSync('dashboard.html', 'utf8');
const activity = fs.readFileSync('js/dashboard/dashboard-script-10-points_widget_functions.js', 'utf8');
const workout = fs.readFileSync('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js', 'utf8');
const css = fs.readFileSync('css/dashboard/pbb-premium-overlays.css', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');

test('cancelled activities and workouts cannot open the rating screen', () => {
  assert.match(activity, /function closeLogActivity\(\)[\s\S]*?savedActivityData = null;[\s\S]*?switchAppTab/);
  assert.match(activity, /const completedSession = !!\([\s\S]*?successView\.style\.display !== 'none'[\s\S]*?ratingEligible === true/);
  assert.match(activity, /if \(completedSession\) \{[\s\S]*?openWorkoutRatingModal/);
  assert.match(workout, /function closeSuccessScreen\(skipRating\) \{[\s\S]*?const completedSession = !!completedWorkoutDataForShare/);
  assert.match(workout, /if \(!skipRating && completedSession\) \{[\s\S]*?openWorkoutRatingModal/);
  assert.match(workout, /closeSuccessScreen\(true\); \/\/ Skip rating on quit/);
});

test('the rating page follows the paired Balance light and dark themes', () => {
  assert.match(dashboard, /id="workout-rating-modal" class="workout-rating-overlay"/);
  assert.match(dashboard, /workout-rating-kicker">SESSION COMPLETE/);
  assert.match(css, /#workout-rating-modal\.workout-rating-overlay \{[\s\S]*?--rating-page: #090909;[\s\S]*?--rating-text: #f8f7f2/);
  assert.match(css, /html\[data-pbb-theme="light"\] #workout-rating-modal\.workout-rating-overlay \{[\s\S]*?--rating-page: #f7f3eb;[\s\S]*?--rating-surface: #ffffff;[\s\S]*?--rating-text: #171512/);
  assert.match(css, /\.workout-rating-save \{[\s\S]*?var\(--rating-gold-bright\)[\s\S]*?var\(--rating-on-gold\)/);
});

test('Android receives fresh rating behaviour and styles', () => {
  assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=228-themed-workout-rating&video_health=2/);
  assert.match(dashboard, /dashboard-script-10-points_widget_functions\.js\?v=53-rating-completion-gate/);
  assert.match(dashboard, /pbb-premium-overlays\.css\?v=114-themed-workout-rating/);
  assert.match(serviceWorker, /pbb-app-v458-themed-workout-rating/);
});
