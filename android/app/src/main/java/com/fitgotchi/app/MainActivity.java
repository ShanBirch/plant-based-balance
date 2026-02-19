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

        // Keep the screen on while the app is active
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Expose a JavaScript interface so the web page can request
        // Android runtime permissions before calling getUserMedia()
        webViewRef = getBridge().getWebView();
        webViewRef.addJavascriptInterface(new PermissionBridge(), "NativePermissions");

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
            // Hide the navigation bar but keep the status bar visible
            controller.hide(WindowInsetsCompat.Type.navigationBars());
            // Allow bars to reappear temporarily when the user swipes from the edge
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }
}
