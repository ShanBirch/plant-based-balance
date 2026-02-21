package com.fitgotchi.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.ActionBar;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
    private WebView webViewRef;
    private PermissionRequest pendingPermissionRequest;
    /** Holds OAuth fragment from a cold-start deep link until the WebView is ready. */
    private volatile String pendingOAuthFragment = null;

    /**
     * Launcher that shows the native Android "Allow camera?" dialog.
     * When the user responds, we notify both the pending WebChromeClient
     * request (if any) AND JavaScript via a callback.
     */
    private final ActivityResultLauncher<String> cameraPermissionLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestPermission(), isGranted -> {
            // Notify the WebView's pending permission request (if getUserMedia triggered it)
            if (pendingPermissionRequest != null) {
                if (isGranted) {
                    pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
                } else {
                    pendingPermissionRequest.deny();
                }
                pendingPermissionRequest = null;
            }
            // Notify JavaScript so the camera flow can continue
            if (webViewRef != null) {
                final boolean granted = isGranted;
                runOnUiThread(() ->
                    webViewRef.evaluateJavascript(
                        "if(window._onNativeCameraPermission) window._onNativeCameraPermission(" + granted + ")",
                        null)
                );
            }
        });

    /**
     * Launcher for the native Android "Allow microphone?" dialog.
     * Used by the Web Speech API (voice meal logging) and any audio capture.
     */
    private final ActivityResultLauncher<String> microphonePermissionLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestPermission(), isGranted -> {
            if (pendingPermissionRequest != null) {
                if (isGranted) {
                    pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
                } else {
                    pendingPermissionRequest.deny();
                }
                pendingPermissionRequest = null;
            }
            // Notify JavaScript so the voice recording flow can continue
            if (webViewRef != null) {
                final boolean granted = isGranted;
                runOnUiThread(() ->
                    webViewRef.evaluateJavascript(
                        "if(window._onNativeMicrophonePermission) window._onNativeMicrophonePermission(" + granted + ")",
                        null)
                );
            }
        });

    /**
     * Launcher for the native Android "Allow location?" dialog.
     * Used by the weather tracker feature to get the user's location.
     */
    private final ActivityResultLauncher<String> locationPermissionLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestPermission(), isGranted -> {
            if (webViewRef != null) {
                final boolean granted = isGranted;
                runOnUiThread(() ->
                    webViewRef.evaluateJavascript(
                        "if(window._onNativeLocationPermission) window._onNativeLocationPermission(" + granted + ")",
                        null)
                );
            }
        });

    /**
     * Launcher for the native Android "Allow notifications?" dialog (API 33+).
     * Used by the meal reminder and push notification permission flow.
     */
    private final ActivityResultLauncher<String> notificationPermissionLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestPermission(), isGranted -> {
            // Notify JavaScript so the notification settings flow can continue
            if (webViewRef != null) {
                final boolean granted = isGranted;
                runOnUiThread(() ->
                    webViewRef.evaluateJavascript(
                        "if(window._onNativeNotificationPermission) window._onNativeNotificationPermission(" + granted + ")",
                        null)
                );
            }
        });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register the FitGotchi IAP plugin for in-app purchases
        registerPlugin(FitGotchiIAPPlugin.class);

        super.onCreate(savedInstanceState);

        // Explicitly hide any action bar that may persist after splash screen
        ActionBar actionBar = getSupportActionBar();
        if (actionBar != null) {
            actionBar.hide();
        }

        // Make the app edge-to-edge (content goes behind status/nav bars)
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Use a solid white status bar so dark icons are always visible.
        // A transparent status bar relies on web content behind it for contrast,
        // which breaks when the splash immersive mode resets icon appearance.
        getWindow().setStatusBarColor(android.graphics.Color.WHITE);
        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);

        // Use dark status bar icons so they are visible on the white status bar
        WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(true);
        }

        // Re-apply after a delay to survive splash screen immersive mode exit
        getWindow().getDecorView().postDelayed(this::applyStatusBarStyle, 1500);

        // Keep the screen on while the app is active
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Expose a JavaScript interface so the web page can request
        // Android runtime permissions before calling getUserMedia()
        webViewRef = getBridge().getWebView();

        // ── WebView Performance Optimizations ─────────────────────────────
        // These settings dramatically improve load times for the 3.2MB dashboard
        android.webkit.WebSettings webSettings = webViewRef.getSettings();

        // Enable DOM storage (localStorage/sessionStorage) — critical for cached state
        webSettings.setDomStorageEnabled(true);

        // Enable database storage for service worker Cache API
        webSettings.setDatabaseEnabled(true);

        // Cache mode: load from cache when available, reducing network round-trips
        // LOAD_DEFAULT respects server cache-control headers but uses local cache when valid
        webSettings.setCacheMode(android.webkit.WebSettings.LOAD_DEFAULT);

        // Enable hardware acceleration for the WebView (smoother 3D model rendering)
        webViewRef.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);

        // Optimize rendering: allow content to render before all resources are loaded
        webSettings.setBlockNetworkImage(false);
        webSettings.setLoadsImagesAutomatically(true);

        // Enable wide viewport for proper responsive layout
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);

        webViewRef.addJavascriptInterface(new PermissionBridge(), "NativePermissions");

        // If the app was cold-started via an OAuth deep link, save the
        // fragment so it can be retrieved by JavaScript via
        // window.NativePermissions.getPendingOAuthFragment().
        // The auth-guard.js script checks for this on every page load
        // and sets the Supabase session before deciding to redirect.
        Uri deepLinkData = getIntent().getData();
        if (deepLinkData != null && "com.fitgotchi.app".equals(deepLinkData.getScheme())) {
            pendingOAuthFragment = deepLinkData.getFragment();
        }

        // Override onPermissionRequest so that when getUserMedia() fires inside
        // the WebView, we show the native Android "Allow camera?" popup instead
        // of silently denying. This is the critical handler that was missing —
        // without it, the WebView denies camera access at the web-permission
        // level even when the NativePermissions JS bridge has already been used
        // to grant the Android runtime permission.
        webViewRef.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean needsCamera = false;
                    boolean needsAudio = false;
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) needsCamera = true;
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) needsAudio = true;
                    }

                    if (!needsCamera && !needsAudio) {
                        // Neither camera nor audio — let the parent handle it
                        super.onPermissionRequest(request);
                        return;
                    }

                    boolean cameraGranted = !needsCamera || ContextCompat.checkSelfPermission(
                            MainActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
                    boolean audioGranted = !needsAudio || ContextCompat.checkSelfPermission(
                            MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;

                    if (cameraGranted && audioGranted) {
                        // All needed permissions already granted — give WebView access
                        request.grant(request.getResources());
                    } else if (!cameraGranted) {
                        // Camera not yet granted — show the native "Allow camera?" dialog
                        // (audio will be granted next time if also needed)
                        pendingPermissionRequest = request;
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA);
                    } else {
                        // Only audio needed — show the native "Allow microphone?" dialog
                        pendingPermissionRequest = request;
                        microphonePermissionLauncher.launch(Manifest.permission.RECORD_AUDIO);
                    }
                });
            }
        });
    }

    /**
     * JavaScript interface exposed as window.NativePermissions.
     * The web page calls these methods to check / request camera permission
     * before attempting getUserMedia().
     */
    private class PermissionBridge {
        @JavascriptInterface
        public boolean hasCameraPermission() {
            return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                    == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestCameraPermission() {
            runOnUiThread(() -> {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                        == PackageManager.PERMISSION_GRANTED) {
                    // Already granted — notify JS immediately
                    webViewRef.evaluateJavascript(
                        "if(window._onNativeCameraPermission) window._onNativeCameraPermission(true)",
                        null);
                } else {
                    // Show the native Android permission dialog
                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA);
                }
            });
        }

        /**
         * Returns true if the user has permanently denied the camera permission
         * (tapped "Don't ask again" or denied twice). In this state, Android
         * will not show the permission dialog — the user must go to Settings.
         */
        @JavascriptInterface
        public boolean isPermissionPermanentlyDenied() {
            boolean notGranted = ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                    != PackageManager.PERMISSION_GRANTED;
            boolean cannotAskAgain = !ActivityCompat.shouldShowRequestPermissionRationale(
                    MainActivity.this, Manifest.permission.CAMERA);
            return notGranted && cannotAskAgain;
        }

        /**
         * Opens the system App Info screen for this app so the user can
         * manually enable camera or microphone permission.
         */
        @JavascriptInterface
        public void openAppSettings() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", getPackageName(), null));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            });
        }

        /**
         * Returns a pending OAuth fragment from a cold-start deep link, or
         * null if there is none.  Called by auth-guard.js on page load so it
         * can set the Supabase session before the normal "no session → redirect
         * to login" logic runs.  The fragment is cleared after the first call.
         */
        @JavascriptInterface
        public String getPendingOAuthFragment() {
            String fragment = pendingOAuthFragment;
            pendingOAuthFragment = null;
            return fragment;
        }

        /**
         * Opens a URL in the device's default external browser (e.g. Chrome)
         * instead of the WebView's in-app browser overlay. Used for Google
         * OAuth so the browser runs as a separate activity and no URL bar
         * persists inside the app after authentication completes.
         */
        @JavascriptInterface
        public void openExternalBrowser(String url) {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            });
        }

        /**
         * Returns true if notification permission is granted.
         * On Android 12 and below, notifications are allowed by default.
         * On Android 13+ (API 33+), the POST_NOTIFICATIONS runtime permission is required.
         */
        @JavascriptInterface
        public boolean hasNotificationPermission() {
            return NotificationManagerCompat.from(MainActivity.this).areNotificationsEnabled();
        }

        /**
         * Requests the POST_NOTIFICATIONS runtime permission on Android 13+.
         * On older versions, notifications are allowed by default so this
         * calls the JS callback with true immediately.
         * Result is delivered via window._onNativeNotificationPermission(bool).
         */
        @JavascriptInterface
        public void requestNotificationPermission() {
            runOnUiThread(() -> {
                if (NotificationManagerCompat.from(MainActivity.this).areNotificationsEnabled()) {
                    // Already granted — notify JS immediately
                    webViewRef.evaluateJavascript(
                        "if(window._onNativeNotificationPermission) window._onNativeNotificationPermission(true)",
                        null);
                } else if (Build.VERSION.SDK_INT >= 33) {
                    // Android 13+: show the native "Allow notifications?" dialog
                    notificationPermissionLauncher.launch("android.permission.POST_NOTIFICATIONS");
                } else {
                    // Older Android: notifications are controlled at the app level in Settings
                    // Can't request at runtime, so direct user to Settings
                    webViewRef.evaluateJavascript(
                        "if(window._onNativeNotificationPermission) window._onNativeNotificationPermission(false)",
                        null);
                }
            });
        }

        @JavascriptInterface
        public boolean hasMicrophonePermission() {
            return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                    == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestMicrophonePermission() {
            runOnUiThread(() -> {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                        == PackageManager.PERMISSION_GRANTED) {
                    // Already granted — notify JS immediately
                    webViewRef.evaluateJavascript(
                        "if(window._onNativeMicrophonePermission) window._onNativeMicrophonePermission(true)",
                        null);
                } else {
                    microphonePermissionLauncher.launch(Manifest.permission.RECORD_AUDIO);
                }
            });
        }

        /**
         * Returns true if location permission (ACCESS_FINE_LOCATION) is granted.
         */
        @JavascriptInterface
        public boolean hasLocationPermission() {
            return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_FINE_LOCATION)
                    == PackageManager.PERMISSION_GRANTED;
        }

        /**
         * Requests the ACCESS_FINE_LOCATION runtime permission.
         * Result is delivered via window._onNativeLocationPermission(bool).
         */
        @JavascriptInterface
        public void requestLocationPermission() {
            runOnUiThread(() -> {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_FINE_LOCATION)
                        == PackageManager.PERMISSION_GRANTED) {
                    webViewRef.evaluateJavascript(
                        "if(window._onNativeLocationPermission) window._onNativeLocationPermission(true)",
                        null);
                } else {
                    locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION);
                }
            });
        }

        /**
         * Opens Health Connect permissions screen for this app so the user
         * can grant health data access directly. Used as a fallback when the
         * Capacitor health plugin can't request permissions inline.
         * The JS side should recheck permission status when onResume fires.
         */
        @JavascriptInterface
        public void openHealthConnect() {
            runOnUiThread(() -> {
                try {
                    // Open Health Connect permissions page for this specific app
                    Intent intent = new Intent("android.health.connect.action.MANAGE_HEALTH_PERMISSIONS");
                    intent.putExtra("android.intent.extra.PACKAGE_NAME", getPackageName());
                    startActivity(intent);
                } catch (Exception e) {
                    try {
                        // Fallback: open Health Connect home settings
                        Intent intent = new Intent("android.health.connect.action.HEALTH_HOME_SETTINGS");
                        startActivity(intent);
                    } catch (Exception e2) {
                        // Health Connect not installed — open generic app settings
                        openAppSettings();
                    }
                }
            });
        }

        /**
         * Opens the notification settings screen specifically for this app.
         * More direct than openAppSettings() when the user needs to toggle
         * notifications on/off.
         */
        @JavascriptInterface
        public void openNotificationSettings() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                    intent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception e) {
                    // Fallback to generic app settings
                    openAppSettings();
                }
            });
        }

        /**
         * Returns true if the POST_NOTIFICATIONS permission has been permanently
         * denied (user tapped "Don't allow" and the system won't show the dialog
         * again). Only meaningful on Android 13+ (API 33+).
         */
        @JavascriptInterface
        public boolean isNotificationPermPermanentlyDenied() {
            if (Build.VERSION.SDK_INT < 33) return true; // Can't request at runtime on older Android
            boolean notGranted = ContextCompat.checkSelfPermission(MainActivity.this,
                    "android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED;
            boolean cannotAskAgain = !ActivityCompat.shouldShowRequestPermissionRationale(
                    MainActivity.this, "android.permission.POST_NOTIFICATIONS");
            return notGranted && cannotAskAgain;
        }

        /**
         * Enters full immersive mode — hides both the status bar and
         * navigation bar. Used when the camera view opens so that
         * media controls (e.g. Spotify) and other status bar items
         * don't obscure the camera UI.
         */
        @JavascriptInterface
        public void enterImmersiveMode() {
            runOnUiThread(() -> {
                WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
                if (controller != null) {
                    controller.hide(WindowInsetsCompat.Type.systemBars());
                    controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                }
            });
        }

        /**
         * Exits full immersive mode — restores the status bar while
         * keeping the navigation bar hidden (matching the app's default).
         */
        @JavascriptInterface
        public void exitImmersiveMode() {
            runOnUiThread(() -> {
                WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
                if (controller != null) {
                    controller.show(WindowInsetsCompat.Type.statusBars());
                    controller.hide(WindowInsetsCompat.Type.navigationBars());
                    controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    // Restore dark icons so they remain visible on the white status bar
                    controller.setAppearanceLightStatusBars(true);
                }
            });
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        // Hide system bars for immersive experience
        hideSystemBars();

        // Notify JavaScript about current permission status so the UI can
        // update after the user returns from Health Connect or notification Settings
        if (webViewRef != null) {
            boolean notifEnabled = NotificationManagerCompat.from(this).areNotificationsEnabled();
            boolean locationEnabled = ContextCompat.checkSelfPermission(this,
                    Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            webViewRef.evaluateJavascript(
                "if(window._onPermissionRecheck) window._onPermissionRecheck(" + notifEnabled + ");" +
                "if(window._recheckHealthPermission) window._recheckHealthPermission();" +
                "if(window._recheckLocationPermission) window._recheckLocationPermission(" + locationEnabled + ")",
                null);
        }
    }

    @Override
    public void setTitle(CharSequence title) {
        // Always use app name — prevents the remote URL from showing as the title
        super.setTitle("Balance");
    }

    @Override
    public void setTitle(int titleId) {
        super.setTitle("Balance");
    }

    private void hideSystemBars() {
        applyStatusBarStyle();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            // Hide the navigation bar but keep the status bar visible
            controller.hide(WindowInsetsCompat.Type.navigationBars());
            // Allow bars to reappear temporarily when the user swipes from the edge
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }

    /** Ensures the status bar has a white background with dark icons. */
    private void applyStatusBarStyle() {
        getWindow().setStatusBarColor(android.graphics.Color.WHITE);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(true);
        }
    }

    // ── OAuth deep-link handling ────────────────────────────────────────
    // After Google sign-in in the system browser, Supabase redirects to
    //   com.fitgotchi.app://login-callback#access_token=…&refresh_token=…
    // Android routes this intent here so we can inject the tokens into
    // the WebView and let Supabase set the session.

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleOAuthDeepLink(intent);
    }

    /**
     * Extract the OAuth fragment from a deep-link intent and inject it
     * into the running WebView.  This handles the warm-start case where
     * the app is already running.  Cold-start deep links are handled by
     * {@link #pendingOAuthFragment} + getPendingOAuthFragment() in the
     * JavaScript bridge.
     */
    private void handleOAuthDeepLink(Intent intent) {
        Uri uri = intent.getData();
        if (uri == null) return;

        String scheme = uri.getScheme();
        if (!"com.fitgotchi.app".equals(scheme)) return;

        String fragment = uri.getFragment();
        if (fragment == null || fragment.isEmpty()) return;

        injectOAuthTokens(fragment);
    }

    /** Evaluate a small JS snippet that hands the token fragment to the page. */
    private void injectOAuthTokens(String fragment) {
        WebView wv = getBridge().getWebView();
        if (wv == null) return;

        // Escape for safe embedding inside a JS string literal
        String safe = fragment.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "");
        String js = "if(window._handleOAuthCallback){window._handleOAuthCallback('" + safe + "')}";
        runOnUiThread(() -> wv.evaluateJavascript(js, null));
    }
}
