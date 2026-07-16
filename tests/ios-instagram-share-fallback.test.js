const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(
    path.join(root, 'js/dashboard/dashboard-script-10-points_widget_functions.js'),
    'utf8'
);
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

const nativeFallback = script.match(
    /if \(isBalanceNativeInstagramSurface\(\)\) \{([\s\S]*?)showToast\('Could not open Instagram directly\./
);

if (!nativeFallback) {
    throw new Error('Native Instagram fallback block is missing');
}

if (!/getBalanceNativePlatform\(\) === 'ios'[\s\S]*shareBalanceCardImageExternally\(/.test(nativeFallback[1])) {
    throw new Error('iOS must fall back to the native share sheet when the direct Instagram bridge fails');
}

if (!/dashboard-script-10-points_widget_functions\.js\?v=26/.test(dashboard)) {
    throw new Error('Dashboard must load the cache-busted Instagram fallback script');
}

console.log('iOS Instagram share fallback contract ok');
