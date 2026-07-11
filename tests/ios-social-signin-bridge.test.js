const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const viewController = fs.readFileSync(path.join(root, 'ios', 'App', 'App', 'ViewController.swift'), 'utf8');
const authPlugin = fs.readFileSync(path.join(root, 'ios', 'App', 'App', 'FitGotchiAuthPlugin.swift'), 'utf8');
const entitlements = fs.readFileSync(path.join(root, 'ios', 'App', 'App', 'App.entitlements'), 'utf8');
const project = fs.readFileSync(path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'), 'utf8');

assert.match(
    viewController,
    /bridge\?\.registerPluginInstance\(FitGotchiAuthPlugin\(\)\)/,
    'iOS must register the native social-auth bridge before login.html tries to use it'
);
assert.match(authPlugin, /CAPPluginMethod\(name: "openOAuth"/, 'Google must have the secure system-browser OAuth bridge');
assert.match(authPlugin, /CAPPluginMethod\(name: "signInWithApple"/, 'Apple must have the native credential bridge');
assert.match(entitlements, /<key>com\.apple\.developer\.applesignin<\/key>[\s\S]*?<string>Default<\/string>/, 'iOS must request the Sign in with Apple entitlement');
assert.match(project, /com\.apple\.SignInWithApple = \{[\s\S]*?enabled = 1;/, 'Xcode must enable the Sign in with Apple capability');

console.log('iOS social sign-in bridge contract ok');
