package com.fitgotchi.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.ActionBar;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

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
