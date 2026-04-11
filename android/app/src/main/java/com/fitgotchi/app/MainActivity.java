package com.fitgotchi.app;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Base64;
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
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    private WebView webViewRef;
    private PermissionRequest pendingPermissionRequest;

    // Native speech recognition for WebView voice input
    private SpeechRecognizer nativeSpeechRecognizer;
    private boolean nativeSpeechListening = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Object SPEECH_RESTART_TOKEN = new Object();
    /** Holds OAuth fragment from a cold-start deep link until the WebView is ready. */
    private volatile String pendingOAuthFragment = null;
    /** Holds a shortcut action (e.g. "calorie-tracker") from a long-press app shortcut until the WebView is ready. */
    private volatile String pendingShortcutAction = null;

    private static final String ACTION_CALORIE_TRACKER = "com.fitgotchi.app.ACTION_CALORIE_TRACKER";
    private static final String ACTION_QUICK_MEAL = "com.fitgotchi.app.ACTION_QUICK_MEAL";
    private static final String ACTION_ADMIN_DASHBOARD = "com.fitgotchi.app.ACTION_ADMIN_DASHBOARD";
    private static final String ACTION_BUILD_MEAL = "com.fitgotchi.app.ACTION_BUILD_MEAL";
    private static final String QUICK_MEAL_PREFS = "quick_meal_prefs";
    private static final String QUICK_MEAL_KEY = "pending_quick_meal";
    private static final String SAVED_MEALS_CACHE_KEY = "saved_meals_cache";

    /** URI where the native camera shortcut saves its photo. */
    private Uri nativeCameraOutputUri = null;
    /** True while the shortcut native camera photo is being processed in the background. */
    private volatile boolean nativeCameraProcessing = false;
    /** Base64 data-URL of the photo taken via the shortcut native camera, ready for JS. */
    private volatile String pendingNativePhotoDataUrl = null;

    /** URI where the workout-share native camera saves its photo. */
    private Uri workoutCameraOutputUri = null;

    /**
     * Launcher for the native Android camera used by the "Log Meal" home-screen shortcut.
     * Opens the system camera app instantly so the user can take a photo while the
     * WebView loads in the background. The resulting JPEG is downscaled and stored as
     * a base64 data-URL that JavaScript retrieves via consumePendingNativePhoto().
     */
    private final ActivityResultLauncher<Uri> nativeCameraLauncher =
        registerForActivityResult(new ActivityResultContracts.TakePicture(), success -> {
            if (!success || nativeCameraOutputUri == null) {
                // User cancelled — JS will fall back to opening the in-app camera
                nativeCameraProcessing = false;
                return;
            }
            // Decode, downscale, and base64-encode on a background thread
            final Uri photoUri = nativeCameraOutputUri;
            new Thread(() -> {
                try {
                    InputStream is = getContentResolver().openInputStream(photoUri);
                    Bitmap bitmap = BitmapFactory.decodeStream(is);
                    if (is != null) is.close();
                    if (bitmap == null) return;
                    // Downscale to max 1024px wide to keep the data-URL manageable
                    int maxW = 1024;
                    if (bitmap.getWidth() > maxW) {
                        int h = (int) (bitmap.getHeight() * (float) maxW / bitmap.getWidth());
                        Bitmap scaled = Bitmap.createScaledBitmap(bitmap, maxW, h, true);
                        bitmap.recycle();
                        bitmap = scaled;
                    }
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 80, baos);
                    bitmap.recycle();
                    String b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
                    pendingNativePhotoDataUrl = "data:image/jpeg;base64," + b64;
                } catch (Exception e) {
                    // Photo processing failed — JS will fall back to in-app camera
                } finally {
                    nativeCameraProcessing = false;
                }
            }).start();
        });

    /**
     * Launcher for the native Android camera used by the workout-share XP flow.
     * Called on demand from JavaScript via takeWorkoutPhoto(). The resulting
     * JPEG is downscaled and delivered to JS as a base64 data-URL via the
     * window._onNativeWorkoutPhoto(dataUrl) callback. Passing null means the
     * user cancelled.
     */
    private final ActivityResultLauncher<Uri> workoutCameraLauncher =
        registerForActivityResult(new ActivityResultContracts.TakePicture(), success -> {
            if (!success || workoutCameraOutputUri == null) {
                // User cancelled — notify JS with null so it can clean up
                if (webViewRef != null) {
                    runOnUiThread(() ->
                        webViewRef.evaluateJavascript(
                            "if(window._onNativeWorkoutPhoto) window._onNativeWorkoutPhoto(null)",
                            null)
                    );
                }
                return;
            }
            final Uri photoUri = workoutCameraOutputUri;
            new Thread(() -> {
                String dataUrl = null;
                try {
                    InputStream is = getContentResolver().openInputStream(photoUri);
                    Bitmap bitmap = BitmapFactory.decodeStream(is);
                    if (is != null) is.close();
                    if (bitmap != null) {
                        // Downscale to max 1280px wide for sharing (smaller keeps payload lean)
                        int maxW = 1280;
                        if (bitmap.getWidth() > maxW) {
                            int h = (int) (bitmap.getHeight() * (float) maxW / bitmap.getWidth());
                            Bitmap scaled = Bitmap.createScaledBitmap(bitmap, maxW, h, true);
                            bitmap.recycle();
                            bitmap = scaled;
                        }
                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        bitmap.compress(Bitmap.CompressFormat.JPEG, 85, baos);
                        bitmap.recycle();
                        String b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
                        dataUrl = "data:image/jpeg;base64," + b64;
                    }
                } catch (Exception e) {
                    // Processing failed — fall through with null
                }
                final String finalDataUrl = dataUrl;
                if (webViewRef != null) {
                    runOnUiThread(() -> {
                        String js;
                        if (finalDataUrl == null) {
                            js = "if(window._onNativeWorkoutPhoto) window._onNativeWorkoutPhoto(null)";
                        } else {
                            // Stash the payload on window to avoid escaping a huge string into a JS call.
                            webViewRef.evaluateJavascript(
                                "window._nativeWorkoutPhotoPayload = " + jsonStringQuote(finalDataUrl) + ";",
                                null);
                            js = "if(window._onNativeWorkoutPhoto) window._onNativeWorkoutPhoto(window._nativeWorkoutPhotoPayload); window._nativeWorkoutPhotoPayload = null;";
                        }
                        webViewRef.evaluateJavascript(js, null);
                    });
                }
            }).start();
        });

    /**
     * JSON-encode a string so it can be safely injected into evaluateJavascript.
     * Wraps in quotes and escapes special characters. Only used for trusted
     * server-side-generated payloads (base64 data URLs).
     */
    private static String jsonStringQuote(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 16);
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"':  sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append('"');
        return sb.toString();
    }

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

        // Check if launched from a long-press app shortcut
        if (ACTION_CALORIE_TRACKER.equals(getIntent().getAction())) {
            pendingShortcutAction = "calorie-tracker";
            // Launch the native system camera immediately so the user sees the
            // camera viewfinder right away while the WebView loads in the background.
            launchNativeCameraForShortcut();
        } else if (ACTION_ADMIN_DASHBOARD.equals(getIntent().getAction())) {
            pendingShortcutAction = "admin-dashboard";
        } else if (ACTION_BUILD_MEAL.equals(getIntent().getAction())) {
            // Launched from QuickMealActivity's "Build New Meal" button — open the
            // in-app meal builder modal once the WebView is ready.
            pendingShortcutAction = "build-meal";
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
         * Returns a pending shortcut action from a long-press app shortcut,
         * or null if there is none. Called by dashboard.html on load so it
         * can navigate directly to the requested view (e.g. calorie tracker).
         * The action is cleared after the first call.
         */
        @JavascriptInterface
        public String getPendingShortcutAction() {
            String action = pendingShortcutAction;
            pendingShortcutAction = null;
            return action;
        }

        /**
         * Returns the pending quick meal JSON from QuickMealActivity, or null
         * if there is none. The data is consumed (deleted) after retrieval so
         * subsequent calls return null.
         */
        @JavascriptInterface
        public String getPendingQuickMeal() {
            SharedPreferences prefs = getSharedPreferences(QUICK_MEAL_PREFS, MODE_PRIVATE);
            String json = prefs.getString(QUICK_MEAL_KEY, null);
            if (json != null) {
                prefs.edit().remove(QUICK_MEAL_KEY).apply();
            }
            return json;
        }

        /**
         * Returns ALL pending quick meals as a JSON array string, or null if
         * the queue is empty. Consumes (clears) both the queue and legacy
         * single key after retrieval. This allows multiple barcode scans or
         * text meals to accumulate and all get processed at once.
         */
        @JavascriptInterface
        public String getPendingQuickMeals() {
            SharedPreferences prefs = getSharedPreferences(QUICK_MEAL_PREFS, MODE_PRIVATE);
            String queueJson = prefs.getString("pending_quick_meal_queue", null);
            if (queueJson != null) {
                // Clear both queue and legacy key
                prefs.edit()
                    .remove("pending_quick_meal_queue")
                    .remove(QUICK_MEAL_KEY)
                    .apply();
                return queueJson;
            }
            // Fallback: check legacy single key
            String singleJson = prefs.getString(QUICK_MEAL_KEY, null);
            if (singleJson != null) {
                prefs.edit().remove(QUICK_MEAL_KEY).apply();
                // Wrap in array for consistent handling
                return "[" + singleJson + "]";
            }
            return null;
        }

        /**
         * Cache the user's saved meals (built via the in-app meal builder) so
         * QuickMealActivity can display them in its "Your Meals" list without
         * launching the WebView. The web side calls this whenever the saved-meal
         * list changes (load, save, log). Pass an empty string to clear.
         */
        @JavascriptInterface
        public void setSavedMealsCache(String json) {
            try {
                SharedPreferences prefs = getSharedPreferences(QUICK_MEAL_PREFS, MODE_PRIVATE);
                if (json == null || json.isEmpty()) {
                    prefs.edit().remove(SAVED_MEALS_CACHE_KEY).apply();
                } else {
                    prefs.edit().putString(SAVED_MEALS_CACHE_KEY, json).apply();
                }
            } catch (Exception ignored) {}
        }

        /**
         * Read the cached saved-meals JSON. Used by QuickMealActivity, and also
         * exposed to JS for debugging.
         */
        @JavascriptInterface
        public String getSavedMealsCache() {
            try {
                SharedPreferences prefs = getSharedPreferences(QUICK_MEAL_PREFS, MODE_PRIVATE);
                return prefs.getString(SAVED_MEALS_CACHE_KEY, null);
            } catch (Exception e) {
                return null;
            }
        }

        /**
         * Launch the native QuickMealActivity in camera mode (photo + barcode).
         * Called from JavaScript when the user taps the camera button in the tracker.
         */
        @JavascriptInterface
        public void openQuickMealCamera() {
            Intent intent = new Intent(MainActivity.this, QuickMealActivity.class);
            intent.putExtra("mode", "camera");
            startActivity(intent);
        }

        /**
         * Launch the native QuickMealActivity in text/card mode.
         * Called from JavaScript when the user taps the pen/text button in the tracker.
         */
        @JavascriptInterface
        public void openQuickMealText() {
            Intent intent = new Intent(MainActivity.this, QuickMealActivity.class);
            intent.putExtra("mode", "text");
            startActivity(intent);
        }

        /**
         * Launch the native QuickMealActivity in camera mode, but tagged for
         * the Meal Builder flow. Instead of logging the captured photo /
         * scanned barcode as a standalone meal (firing a notification,
         * appending to the regular pending-meal queue), QuickMealActivity
         * writes the analysed result to a separate "builder" queue that the
         * WebView meal builder reads on resume via getPendingBuilderItems().
         * This lets the user compose a multi-item meal from multiple photos
         * or barcodes.
         */
        @JavascriptInterface
        public void openQuickMealCameraForBuilder() {
            Intent intent = new Intent(MainActivity.this, QuickMealActivity.class);
            intent.putExtra("mode", "camera");
            intent.putExtra("builder_mode", true);
            startActivity(intent);
        }

        /**
         * Return (and consume) all pending Meal Builder items that were
         * produced by QuickMealActivity running in builder mode. Returns a
         * JSON array string where each entry is an /analyze-food style
         * response ({ foodItems: [...], totals: {...}, ... }), or null if
         * the queue is empty.
         */
        @JavascriptInterface
        public String getPendingBuilderItems() {
            SharedPreferences prefs = getSharedPreferences(QUICK_MEAL_PREFS, MODE_PRIVATE);
            String queueJson = prefs.getString("pending_builder_items_queue", null);
            if (queueJson != null) {
                prefs.edit().remove("pending_builder_items_queue").apply();
                return queueJson;
            }
            return null;
        }

        /**
         * Return (and consume) all raw photos that QuickMealActivity captured
         * while running in builder mode. Unlike getPendingBuilderItems(),
         * these photos have NOT been sent to /analyze-food yet — the WebView
         * meal builder shows a portion prompt first ("how much did you
         * have?") and then runs analyse-food itself with that description
         * so Gemini can size the macros to the user's actual portion.
         * Each entry looks like:
         *   { "base64": "...", "mimeType": "image/jpeg", "timestamp": 172... }
         * Returns null if the queue is empty.
         */
        @JavascriptInterface
        public String getPendingBuilderPhotos() {
            SharedPreferences prefs = getSharedPreferences(QUICK_MEAL_PREFS, MODE_PRIVATE);
            String queueJson = prefs.getString("pending_builder_photos_queue", null);
            if (queueJson != null) {
                prefs.edit().remove("pending_builder_photos_queue").apply();
                return queueJson;
            }
            return null;
        }

        /**
         * Launch the system camera app to take a workout verification photo.
         * This replaces the in-WebView getUserMedia() camera for the post-workout
         * XP share flow — the native camera opens instantly and takes a full-
         * resolution photo. The result is delivered to JS asynchronously via
         *   window._onNativeWorkoutPhoto(dataUrlOrNull)
         * where the data URL is a downscaled JPEG, or null if the user cancelled.
         *
         * JS must ensure camera permission is granted (via hasCameraPermission()
         * + requestCameraPermission()) before calling this method, since the
         * TakePicture intent contract does not prompt for permission.
         */
        @JavascriptInterface
        public void takeWorkoutPhoto() {
            runOnUiThread(() -> {
                try {
                    File tempFile = new File(getCacheDir(), "workout_share_photo.jpg");
                    workoutCameraOutputUri = FileProvider.getUriForFile(
                            MainActivity.this, getPackageName() + ".fileprovider", tempFile);
                    workoutCameraLauncher.launch(workoutCameraOutputUri);
                } catch (Exception e) {
                    // Could not launch camera — notify JS so it can fall back
                    webViewRef.evaluateJavascript(
                        "if(window._onNativeWorkoutPhoto) window._onNativeWorkoutPhoto(null)",
                        null);
                }
            });
        }

        /**
         * Returns the status of a photo taken via the shortcut native camera:
         *   ""          — camera was launched, photo is still being processed
         *   "data:..."  — photo ready; call again returns null (consumed)
         *   null        — no native camera shortcut was used (or user cancelled)
         *
         * JavaScript polls this after detecting a "calorie-tracker" shortcut action.
         * When a data-URL is returned it is consumed so subsequent calls return null.
         */
        @JavascriptInterface
        public String consumePendingNativePhoto() {
            if (nativeCameraProcessing) return "";        // still encoding
            String photo = pendingNativePhotoDataUrl;
            if (photo != null) {
                pendingNativePhotoDataUrl = null;         // consume
                return photo;
            }
            return null;                                  // not used or cancelled
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
         * Starts native Android speech recognition and streams results back
         * to JavaScript via window._onNativeSpeechResult(text, isFinal) and
         * window._onNativeSpeechError(error). Much more accurate than the
         * Web Speech API inside a WebView.
         */
        @JavascriptInterface
        public void startNativeSpeechRecognition() {
            runOnUiThread(() -> {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED) {
                    webViewRef.evaluateJavascript(
                        "if(window._onNativeSpeechError) window._onNativeSpeechError('permission-denied')", null);
                    return;
                }
                if (!SpeechRecognizer.isRecognitionAvailable(MainActivity.this)) {
                    webViewRef.evaluateJavascript(
                        "if(window._onNativeSpeechError) window._onNativeSpeechError('not-available')", null);
                    return;
                }
                stopNativeSpeechInternal();

                nativeSpeechRecognizer = SpeechRecognizer.createSpeechRecognizer(MainActivity.this);
                nativeSpeechRecognizer.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(android.os.Bundle params) {
                        nativeSpeechListening = true;
                        webViewRef.evaluateJavascript(
                            "if(window._onNativeSpeechStart) window._onNativeSpeechStart()", null);
                    }
                    @Override public void onBeginningOfSpeech() {}
                    @Override public void onRmsChanged(float rmsdB) {}
                    @Override public void onBufferReceived(byte[] buffer) {}
                    @Override public void onEndOfSpeech() {}
                    @Override public void onError(int error) {
                        nativeSpeechListening = false;
                        // Errors 6 (ERROR_NO_MATCH) and 7 (ERROR_SPEECH_TIMEOUT) are
                        // non-fatal — auto-restart so the user can keep speaking
                        if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                            mainHandler.postAtTime(() -> startNativeSpeechListeningIntent(),
                                SPEECH_RESTART_TOKEN, android.os.SystemClock.uptimeMillis() + 300);
                        } else {
                            webViewRef.evaluateJavascript(
                                "if(window._onNativeSpeechError) window._onNativeSpeechError('error-" + error + "')", null);
                        }
                    }
                    @Override public void onResults(android.os.Bundle results) {
                        nativeSpeechListening = false;
                        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (matches != null && !matches.isEmpty()) {
                            String text = matches.get(0).replace("'", "\\'").replace("\"", "\\\"").replace("\n", " ");
                            webViewRef.evaluateJavascript(
                                "if(window._onNativeSpeechResult) window._onNativeSpeechResult('" + text + "', true)", null);
                        }
                        // Auto-restart so user can keep dictating
                        mainHandler.postAtTime(() -> startNativeSpeechListeningIntent(),
                            SPEECH_RESTART_TOKEN, android.os.SystemClock.uptimeMillis() + 300);
                    }
                    @Override public void onPartialResults(android.os.Bundle partial) {
                        ArrayList<String> matches = partial.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (matches != null && !matches.isEmpty()) {
                            String text = matches.get(0).replace("'", "\\'").replace("\"", "\\\"").replace("\n", " ");
                            webViewRef.evaluateJavascript(
                                "if(window._onNativeSpeechResult) window._onNativeSpeechResult('" + text + "', false)", null);
                        }
                    }
                    @Override public void onEvent(int eventType, android.os.Bundle params) {}
                });

                startNativeSpeechListeningIntent();
            });
        }

        @JavascriptInterface
        public void stopNativeSpeechRecognition() {
            runOnUiThread(() -> stopNativeSpeechInternal());
        }

        @JavascriptInterface
        public boolean isNativeSpeechAvailable() {
            return SpeechRecognizer.isRecognitionAvailable(MainActivity.this);
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
         * Minimizes the app (sends it to the background) without killing it.
         * Used by the quick meal logging shortcut so the user can snap a photo,
         * submit, and get back to what they were doing while analysis runs.
         */
        @JavascriptInterface
        public void minimizeApp() {
            runOnUiThread(() -> moveTaskToBack(true));
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

    private void startNativeSpeechListeningIntent() {
        if (nativeSpeechRecognizer == null) return;
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        nativeSpeechRecognizer.startListening(intent);
    }

    private void stopNativeSpeechInternal() {
        mainHandler.removeCallbacksAndMessages(SPEECH_RESTART_TOKEN);
        nativeSpeechListening = false;
        if (nativeSpeechRecognizer != null) {
            try { nativeSpeechRecognizer.stopListening(); } catch (Exception ignored) {}
            try { nativeSpeechRecognizer.cancel(); } catch (Exception ignored) {}
            try { nativeSpeechRecognizer.destroy(); } catch (Exception ignored) {}
            nativeSpeechRecognizer = null;
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

            // Process any pending quick meals immediately when resuming
            // (e.g. returning from QuickMealActivity barcode scans).
            // Small delay ensures the WebView JS is ready.
            webViewRef.postDelayed(() -> {
                if (webViewRef != null) {
                    webViewRef.evaluateJavascript(
                        "if(typeof _processQuickMealFromNative === 'function') _processQuickMealFromNative();",
                        null);
                }
            }, 500);
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

    /**
     * Opens the system camera app immediately when the "Log Meal" shortcut is tapped.
     * The photo is saved to the app's cache directory via FileProvider so no storage
     * permission is needed. Processing happens in the background while the WebView loads.
     */
    private void launchNativeCameraForShortcut() {
        try {
            File tempFile = new File(getCacheDir(), "shortcut_meal_photo.jpg");
            nativeCameraOutputUri = FileProvider.getUriForFile(
                    this, getPackageName() + ".fileprovider", tempFile);
            nativeCameraProcessing = true;
            pendingNativePhotoDataUrl = null;
            nativeCameraLauncher.launch(nativeCameraOutputUri);
        } catch (Exception e) {
            nativeCameraProcessing = false;
            // Could not launch camera — JS will open the in-app camera normally
        }
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
        handleShortcutIntent(intent);
    }

    /**
     * If the intent came from a long-press app shortcut while the app is
     * already running, inject JS to navigate directly to the target view.
     */
    private void handleShortcutIntent(Intent intent) {
        if (intent == null) return;
        if (ACTION_CALORIE_TRACKER.equals(intent.getAction())) {
            WebView wv = getBridge().getWebView();
            if (wv != null) {
                runOnUiThread(() -> wv.evaluateJavascript(
                    "if(typeof openMealCameraDirect==='function'){openMealCameraDirect('shortcut')}",
                    null));
            }
        } else if (ACTION_ADMIN_DASHBOARD.equals(intent.getAction())) {
            WebView wv = getBridge().getWebView();
            if (wv != null) {
                runOnUiThread(() -> wv.loadUrl("https://plantbased-balance.org/admin-dashboard.html"));
            }
        } else if (ACTION_BUILD_MEAL.equals(intent.getAction())) {
            // Warm-start: app is already running, just open the builder
            WebView wv = getBridge().getWebView();
            if (wv != null) {
                runOnUiThread(() -> wv.evaluateJavascript(
                    "if(typeof openMealBuilder==='function'){openMealBuilder()}",
                    null));
            }
        }
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

    @Override
    public void onDestroy() {
        stopNativeSpeechInternal();
        super.onDestroy();
    }
}
