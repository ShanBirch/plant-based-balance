const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-2-activity_insights_view.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/dashboard/dashboard-style-1.css'), 'utf8');

function expectMatch(value, pattern, message) {
    if (!pattern.test(value)) throw new Error(message);
}

expectMatch(script, /class="insights-weigh-in-action insights-weigh-in-action--edit"/, 'Body Weight Edit must use the themed action class');
expectMatch(script, /class="insights-weigh-in-action insights-weigh-in-action--delete"/, 'Body Weight Delete must use the themed action class');
expectMatch(css, /html\[data-pbb-theme="light"\] \.insights-weigh-in-action--edit[\s\S]*?color: #6c5017 !important;/, 'Light Edit needs an explicit dark gold foreground');
expectMatch(css, /html\[data-pbb-theme="light"\] \.insights-weigh-in-action--delete[\s\S]*?color: #991b1b !important;/, 'Light Delete needs an explicit dark red foreground');
expectMatch(css, /\.insights-weigh-in-action:focus-visible[\s\S]*?outline: 3px solid/, 'Actions need a visible keyboard focus ring');
expectMatch(css, /-webkit-text-fill-color:[^;]+!important;/, 'Action text needs an explicit WebKit fill colour for iPhone');

console.log('Activity Insights Body Weight action contrast checks passed.');
