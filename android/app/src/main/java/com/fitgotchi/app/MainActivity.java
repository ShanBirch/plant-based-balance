package com.fitgotchi.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
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
    private String pendingOAuthFragment = null;

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

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register the FitGotchi IAP plugin for in-app purchases
        registerPlugin(FitGotchiIAPPlugin.class);
        // Register the Screen Time plugin for Android usage stats sync
        registerPlugin(ScreenTimePlugin.class);

        super.onCreate(savedInstanceState);

        // Explicitly hide any action bar that may persist after splash screen
        ActionBar actionBar = getSupportActionBar();
        if (actionBar != null) {
            actionBar.hide();
        }

        // Make the app edge-to-edge (content goes behind status/nav bars)
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Set status bar and nav bar to transparent so the app fills the whole screen
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);

        // Use dark status bar icons so they are visible on light/white backgrounds
        WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(true);
        }

        // Keep the screen on while the app is active
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Expose a JavaScript interface so the web page can request
        // Android runtime permissions before calling getUserMedia()
        webViewRef = getBridge().getWebView();
        webViewRef.addJavascriptInterface(new PermissionBridge(), "NativePermissions");

        // If the app was cold-started via an OAuth deep link, save the
        // fragment so we can inject it once the remote page finishes loading.
        Uri deepLinkData = getIntent().getData();
        if (deepLinkData != null && "com.fitgotchi.app".equals(deepLinkData.getScheme())) {
            pendingOAuthFragment = deepLinkData.getFragment();
            if (pendingOAuthFragment != null && !pendingOAuthFragment.isEmpty()) {
                // Give the remote page time to load before injecting tokens.
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                    if (pendingOAuthFragment != null) {
                        injectOAuthTokens(pendingOAuthFragment);
                        pendingOAuthFragment = null;
                    }
                }, 3500);
            }
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
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            needsCamera = true;
                            break;
                        }
                    }

                    if (!needsCamera) {
                        // Not a camera request — let the parent handle it
                        super.onPermissionRequest(request);
                        return;
                    }

                    if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                            == PackageManager.PERMISSION_GRANTED) {
                        // Android permission already granted — grant to WebView
                        request.grant(request.getResources());
                    } else {
                        // Android permission not yet granted — save the WebView
                        // request and show the native "Allow camera?" dialog
                        pendingPermissionRequest = request;
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA);
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
         * manually enable camera permission.
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
                }
            });
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        // Hide system bars for immersive experience
        hideSystemBars();
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
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            // Use dark status bar icons so they are visible on light/white backgrounds
            controller.setAppearanceLightStatusBars(true);
            // Hide the navigation bar but keep the status bar visible
            controller.hide(WindowInsetsCompat.Type.navigationBars());
            // Allow bars to reappear temporarily when the user swipes from the edge
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
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
     * into the running WebView. For cold-start launches the fragment is
     * stored in {@link #pendingOAuthFragment} and injected once the
     * page finishes loading (see the post-delayed handler in onCreate).
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
