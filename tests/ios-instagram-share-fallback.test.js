const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(
    path.join(root, 'js/dashboard/dashboard-script-10-points_widget_functions.js'),
    'utf8'
);
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

if (!/if \(isBalanceNativeInstagramSurface\(\)\) \{[\s\S]*?return shareBalanceCardImageExternally\(/.test(script)) {
    throw new Error('Native Android and iOS must fall back to the share sheet when the direct Instagram bridge fails');
}

if (/Could not open Instagram directly/.test(script)) {
    throw new Error('Native Instagram failure must not dead-end with the old direct-open error');
}

if (!/dashboard-script-10-points_widget_functions\.js\?v=27/.test(dashboard)) {
    throw new Error('Dashboard must load the cache-busted Instagram fallback script');
}

console.log('Android and iOS Instagram share fallback contract ok');
