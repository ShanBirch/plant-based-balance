const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const viewController = fs.readFileSync(path.join(root, 'ios', 'App', 'App', 'ViewController.swift'), 'utf8');
const authPlugin = fs.readFileSync(path.join(root, 'ios', 'App', 'App', 'FitGotchiAuthPlugin.swift'), 'utf8');
const entitlements = fs.readFileSync(path.join(root, 'ios', 'App', 'App', 'App.entitlements'), 'utf8');
const infoPlist = fs.readFileSync(path.join(root, 'ios', 'App', 'App', 'Info.plist'), 'utf8');
const project = fs.readFileSync(path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'), 'utf8');
const login = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
const oauthCallback = fs.readFileSync(path.join(root, 'oauth-callback.html'), 'utf8');

assert.match(
    viewController,
    /bridge\?\.registerPluginInstance\(FitGotchiAuthPlugin\(\)\)/,
    'iOS must register the native social-auth bridge before login.html tries to use it'
);
assert.match(authPlugin, /CAPPluginMethod\(name: "openOAuth"/, 'Google must have the secure system-browser OAuth bridge');
assert.match(authPlugin, /callbackURLScheme:\s*callbackScheme/, 'Google OAuth must give ASWebAuthenticationSession a callback scheme');
assert.match(authPlugin, /let callbackScheme = "com\.fitgotchi\.app"/, 'The iOS OAuth bridge must use the app callback scheme');
assert.match(infoPlist, /<key>CFBundleURLSchemes<\/key>[\s\S]*?<string>com\.fitgotchi\.app<\/string>/, 'iOS must register the OAuth callback scheme');
assert.match(login, /provider:\s*'google'[\s\S]*?skipBrowserRedirect:\s*true[\s\S]*?FitGotchiAuth\.openOAuth/, 'iPhone Google sign-in must open through the native auth session');
assert.match(oauthCallback, /com\.fitgotchi\.app:\/\/login-callback#/, 'The hosted OAuth callback must return to the iOS app scheme');
assert.match(authPlugin, /CAPPluginMethod\(name: "signInWithApple"/, 'Apple must have the native credential bridge');
assert.match(entitlements, /<key>com\.apple\.developer\.applesignin<\/key>[\s\S]*?<string>Default<\/string>/, 'iOS must request the Sign in with Apple entitlement');
assert.match(project, /com\.apple\.SignInWithApple = \{[\s\S]*?enabled = 1;/, 'Xcode must enable the Sign in with Apple capability');
assert.match(
    login,
    /\/FitGotchi-Native\/i\.test\(ua\)\s*&&\s*\/\(iPhone\|iPad\|iPod\)\/i\.test\(ua\)[\s\S]*?classList\.add\('ios-native-social-signin-paused'\)/,
    'the current public iOS app must pause social sign-in before the page paints'
);
assert.match(
    login,
    /html\.ios-native-social-signin-paused \.apple-btn,[\s\S]*?html\.ios-native-social-signin-paused \.google-btn,[\s\S]*?display:\s*none\s*!important/,
    'the iOS release gate must hide both Apple and Google buttons'
);
assert.match(
    login,
    /html\.ios-native-social-signin-paused form\.login-email-section,[\s\S]*?display:\s*block\s*!important/,
    'the iOS release gate must keep email sign-in visible'
);

console.log('iOS social sign-in bridge contract ok');
