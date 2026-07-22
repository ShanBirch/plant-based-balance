const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
const shareScript = fs.readFileSync(path.join(__dirname, '..', 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'), 'utf8');

assert.match(shareScript, /pbbShareDrawFullBleedMealCard/);
assert.match(shareScript, /balance_logo_transparent\.png/);
assert.match(shareScript, /instagramSafeTop\s*=\s*isFeed\s*\?\s*118\s*:\s*250/);
assert.match(shareScript, /instagramSafeBottom\s*=\s*isFeed\s*\?\s*176\s*:\s*360/);
assert.match(shareScript, /const contentBottom\s*=\s*height - instagramSafeBottom/);
assert.match(shareScript, /const macroY\s*=\s*Math\.max\(y \+ 116, contentBottom - 202\)/);
assert.match(shareScript, /MEAL SHARED/);
assert.match(shareScript, /Fuel\. Track\. Level up\.|BALANCE/);
assert.match(dashboard, /dashboard-script-10-points_widget_functions\.js\?v=33/);

console.log('Instagram meal share safe-area tests passed');
