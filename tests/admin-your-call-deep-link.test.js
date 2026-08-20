const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
const deepLink = fs.readFileSync(path.join(__dirname, '..', 'js', 'dashboard', 'pbb-admin-deep-link.js'), 'utf8');

assert.ok(
    dashboard.includes('js/dashboard/pbb-admin-deep-link.js?v=your-call-v1'),
    'the client dashboard should load the admin deep-link bridge'
);

assert.ok(
    deepLink.includes("params.get('view_as')") &&
    deepLink.includes("['program', 'meal-plan'].includes(target)") &&
    deepLink.includes('window.isAdminViewing'),
    'deep links should only activate for an authenticated admin view-as session'
);

assert.ok(
    deepLink.includes('window.openYourWorkouts()') &&
    deepLink.includes("window.switchAppTab('meals', mealsButton)") &&
    deepLink.includes('window.openAiMealPlanView'),
    'program and meal-plan links should open the exact client surface'
);

console.log('admin Your Call deep-link tests passed');
