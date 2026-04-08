# iOS TestFlight Setup Guide (No Mac Required)

This guide walks you through setting up automated TestFlight builds using GitHub Actions.
Once set up, every push to `main` will build your iOS app and upload it to TestFlight automatically.

Your testers just install the TestFlight app on their iPhone, accept an invite, and get updates over the air.

---

## Overview

You need to create **7 GitHub Secrets**. Here's how to get each one.

| Secret Name | What It Is |
|-------------|-----------|
| `IOS_TEAM_ID` | Your 10-character Apple Developer Team ID |
| `IOS_BUILD_CERTIFICATE_BASE64` | Your signing certificate (.p12), base64 encoded |
| `IOS_P12_PASSWORD` | Password you set when exporting the .p12 |
| `IOS_PROVISIONING_PROFILE_BASE64` | Your provisioning profile, base64 encoded |
| `IOS_PROVISIONING_PROFILE_NAME` | The name of your provisioning profile |
| `APP_STORE_CONNECT_API_KEY_ID` | App Store Connect API key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | App Store Connect API issuer ID |
| `APP_STORE_CONNECT_API_KEY_BASE64` | The .p8 API key file, base64 encoded |

---

## Step 1: Apple Developer Account

1. Go to https://developer.apple.com/programs/
2. Click **Enroll** and sign up ($99 USD/year)
3. Use your Apple ID — you can do this from any browser, no Mac needed
4. Wait for approval (usually 24-48 hours, sometimes instant)

---

## Step 2: Register Your App ID

1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Click the **+** button to register a new identifier
3. Choose **App IDs** → **App**
4. Fill in:
   - **Description**: `Balance`
   - **Bundle ID**: Select "Explicit" and enter: `com.fitgotchi.app`
5. Under **Capabilities**, enable:
   - **HealthKit**
   - **In-App Purchase**
   - **Push Notifications**
6. Click **Continue** → **Register**

---

## Step 3: Create a Distribution Certificate

⚠️ **This step requires a Mac (or a CSR trick)**

### Option A: Borrow a Mac for 10 minutes
1. Open **Keychain Access** on the Mac
2. Menu: Keychain Access → Certificate Assistant → **Request a Certificate From a Certificate Authority**
3. Enter your email, leave CA Email empty, select **Saved to disk**
4. Save the `.certSigningRequest` file

### Option B: Use a CSR generator online (no Mac)
You can generate a CSR using OpenSSL on any machine (Linux/Windows WSL):
```bash
# Generate a private key
openssl genrsa -out ios_distribution.key 2048

# Generate a CSR from that key
openssl req -new -key ios_distribution.key -out CertificateSigningRequest.certSigningRequest \
  -subj "/emailAddress=YOUR_EMAIL/CN=YOUR_NAME/C=AU"
```
Keep `ios_distribution.key` safe — you'll need it.

### Then (from any browser):
1. Go to https://developer.apple.com/account/resources/certificates/list
2. Click **+** → Choose **Apple Distribution**
3. Upload your `.certSigningRequest` file
4. Download the `.cer` certificate file

### Convert to .p12:
If you used **Option A** (Mac):
1. Double-click the `.cer` to add it to Keychain Access
2. Find it in Keychain Access → right-click → **Export** → Save as `.p12`
3. Set a password (you'll need this for the `IOS_P12_PASSWORD` secret)

If you used **Option B** (OpenSSL):
```bash
# Convert .cer (DER) to .pem
openssl x509 -inform DER -in distribution.cer -out distribution.pem

# Bundle into .p12
openssl pkcs12 -export -out distribution.p12 \
  -inkey ios_distribution.key \
  -in distribution.pem \
  -password pass:YOUR_PASSWORD_HERE
```

### Base64 encode it:
```bash
base64 -i distribution.p12 | tr -d '\n'
```
Copy the output — this is your `IOS_BUILD_CERTIFICATE_BASE64` secret.

---

## Step 4: Create a Provisioning Profile

1. Go to https://developer.apple.com/account/resources/profiles/list
2. Click **+** → Choose **App Store Connect** (under Distribution)
3. Select your App ID: `com.fitgotchi.app`
4. Select your Distribution Certificate (from Step 3)
5. Name it something like: `Balance App Store`
6. Download the `.mobileprovision` file

### Base64 encode it:
```bash
base64 -i Balance_App_Store.mobileprovision | tr -d '\n'
```
Copy the output — this is your `IOS_PROVISIONING_PROFILE_BASE64` secret.

The name you gave it (e.g., `Balance App Store`) is your `IOS_PROVISIONING_PROFILE_NAME` secret.

---

## Step 5: Create Your App in App Store Connect

1. Go to https://appstoreconnect.apple.com/
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: Balance
   - **Primary Language**: English (Australia)
   - **Bundle ID**: Select `com.fitgotchi.app`
   - **SKU**: `com.fitgotchi.app` (or anything unique)
4. Click **Create**

This registers your app so TestFlight can receive builds.

---

## Step 6: Create an App Store Connect API Key

1. Go to https://appstoreconnect.apple.com/access/integrations/api
2. Click **Generate API Key** (or **+**)
3. **Name**: `GitHub Actions`
4. **Access**: `App Manager` (minimum needed for TestFlight uploads)
5. Click **Generate**
6. **IMPORTANT**: Download the `.p8` file immediately — you can only download it ONCE
7. Note the **Key ID** shown in the table
8. Note the **Issuer ID** shown at the top of the page

### Base64 encode the .p8 key:
```bash
base64 -i AuthKey_XXXXXXXXXX.p8 | tr -d '\n'
```

---

## Step 7: Get Your Team ID

1. Go to https://developer.apple.com/account/#/membership/
2. Your **Team ID** is the 10-character alphanumeric code shown there

---

## Step 8: Add All Secrets to GitHub

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** for each:

| Secret | Value |
|--------|-------|
| `IOS_TEAM_ID` | Your 10-char Team ID from Step 7 |
| `IOS_BUILD_CERTIFICATE_BASE64` | Base64 output from Step 3 |
| `IOS_P12_PASSWORD` | The password you set in Step 3 |
| `IOS_PROVISIONING_PROFILE_BASE64` | Base64 output from Step 4 |
| `IOS_PROVISIONING_PROFILE_NAME` | The profile name, e.g. `Balance App Store` |
| `APP_STORE_CONNECT_API_KEY_ID` | Key ID from Step 6 |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID from Step 6 |
| `APP_STORE_CONNECT_API_KEY_BASE64` | Base64 of .p8 file from Step 6 |

---

## Step 9: Push and Test!

Push to `main` (or trigger the workflow manually from the Actions tab).

The workflow will:
1. Build the app on a macOS runner
2. Sign it with your certificate
3. Upload it to TestFlight

First build takes ~15-20 minutes. After that:
1. Open **TestFlight** on the iPhone
2. You should see the **Balance** app ready to install
3. Tap **Install** → test it!

---

## Step 10: Add Testers

1. Go to App Store Connect → Your App → **TestFlight** tab
2. Under **Internal Testing**, click **+** next to testers
3. Add email addresses — they'll get an invite to install via TestFlight

You can have up to **25 internal testers** (must be part of your team) or
up to **10,000 external testers** (just need an email + Apple approval of your first build).

---

## Troubleshooting

### "No signing certificate found"
Your `IOS_BUILD_CERTIFICATE_BASE64` secret is wrong or the certificate has expired.
Re-export and re-encode.

### "Provisioning profile doesn't match"
Make sure the profile was created for bundle ID `com.fitgotchi.app` and uses
the same distribution certificate.

### "Unable to upload: app not found"
You need to create the app in App Store Connect first (Step 5).

### Build succeeds but no TestFlight notification
- Check App Store Connect → TestFlight tab for processing status
- First build can take 15-30 min to process on Apple's side
- Make sure the tester has accepted their TestFlight invite

---

## Why This Is Better Than PWA on iOS

| | PWA on Safari | Capacitor via TestFlight |
|---|---|---|
| Memory limit | ~80-120MB (WebKit kills it) | ~300-500MB (native app limit) |
| Background execution | None (killed immediately) | Limited background modes |
| Push notifications | Limited (iOS 16.4+) | Full APNs support |
| App icon | "Add to Home Screen" | Real app from TestFlight |
| Health data | No access | Full HealthKit |
| In-App Purchases | Not possible | StoreKit works |
| Crash reporting | Nothing | Xcode Organizer / crashlytics |
