const assert = require('assert');
const fs = require('fs');
const path = require('path');

const stories = fs.readFileSync(path.join(__dirname, '..', 'lib', 'stories.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');

assert.match(stories, /window\.renderMealCard\s*=\s*function/);
assert.match(stories, /balance_logo_transparent\.png/);
assert.match(stories, /rgba\(10,15,13,0\.62\)/);
assert.match(stories, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
assert.match(stories, /Fuel\. Track\. Level up\./);
assert.match(dashboard, /lib\/stories\.js\?v=66/);

console.log('Meal Feed card style tests passed');
