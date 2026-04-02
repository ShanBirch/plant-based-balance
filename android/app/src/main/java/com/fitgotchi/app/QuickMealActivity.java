package com.fitgotchi.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Base64;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;

import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.google.common.util.concurrent.ListenableFuture;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Calendar;
import java.util.concurrent.ExecutionException;

/**
 * Lightweight dialog-themed activity for the "Log Meal" app shortcut.
 * Two modes:
 *   1. CARD — floating text input with camera icon, meal type pills, submit button
 *   2. CAMERA — full-screen CameraX preview with capture/flip buttons
 *
 * After submit the overlay closes instantly and the Netlify API is called
 * on a background thread. A local notification shows the macro breakdown.
 * Results are saved to SharedPreferences for the WebView to persist later.
 */
public class QuickMealActivity extends AppCompatActivity {

    private static final String PREFS_NAME = "quick_meal_prefs";
    private static final String KEY_PENDING = "pending_quick_meal";
    private static final String CHANNEL_ID = "meal-reminders";
    private static final String API_BASE = "https://plantbased-balance.org/.netlify/functions";

    // ── Card mode views ────────────────────────────────────────────────
    private FrameLayout rootLayout;
    private LinearLayout card;
    private EditText mealInput;
    private TextView submitBtn;
    private ImageView photoPreview;
    private TextView photoLabel;
    // ── Camera mode views ──────────────────────────────────────────────
    private FrameLayout cameraContainer;
    private PreviewView previewView;
    private ImageCapture imageCapture;
    private int lensFacing = CameraSelector.LENS_FACING_BACK;
    private BarcodeScanner barcodeScanner;
    private TextView barcodeBanner;
    private String lastDetectedBarcode = null;

    // ── Barcode product overlay views ──────────────────────────────────
    private FrameLayout barcodeOverlay;
    private TextView barcodeProductName;
    private TextView barcodeProductBrand;
    private TextView barcodeCaloriesVal, barcodeProteinVal, barcodeCarbsVal, barcodeFatVal;
    private TextView barcodeFiberVal, barcodeSugarVal, barcodeSodiumVal;
    private LinearLayout barcodeExtrasRow;
    private TextView barcodeServingsDisplay, barcodeServingLabel;
    private TextView barcodeLogBtn;

    // ── Barcode product data ────────────────────────────────────────────
    private JSONObject barcodeProductData = null;
    private double barcodeServings = 1;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // ── State ──────────────────────────────────────────────────────────
    private String selectedMealType;
    private String capturedPhotoBase64 = null;
    private boolean cameraMode = false;

    // Camera permission launcher
    private final ActivityResultLauncher<String> cameraPermLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
            if (granted) enterCameraMode();
        });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        supportRequestWindowFeature(Window.FEATURE_NO_TITLE);
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        ensureNotificationChannel();

        // Init ML Kit barcode scanner
        BarcodeScannerOptions opts = new BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8,
                Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E,
                Barcode.FORMAT_CODE_128, Barcode.FORMAT_CODE_39)
            .build();
        barcodeScanner = BarcodeScanning.getClient(opts);

        int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        if (hour < 11) selectedMealType = "breakfast";
        else if (hour < 15) selectedMealType = "lunch";
        else if (hour < 21) selectedMealType = "dinner";
        else selectedMealType = "snack";

        rootLayout = new FrameLayout(this);
        rootLayout.setBackgroundColor(Color.parseColor("#99000000"));
        rootLayout.setOnClickListener(v -> { if (!cameraMode) finish(); });
        setContentView(rootLayout);

        // Build all UIs — only one visible at a time
        buildCameraView();
        buildCardView();
        buildBarcodeOverlay();

        // Keyboard inset handling for card mode
        ViewCompat.setOnApplyWindowInsetsListener(rootLayout, (v, wi) -> {
            Insets ime = wi.getInsets(WindowInsetsCompat.Type.ime());
            Insets nav = wi.getInsets(WindowInsetsCompat.Type.navigationBars());
            if (card != null) {
                FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) card.getLayoutParams();
                lp.bottomMargin = Math.max(ime.bottom, nav.bottom);
                card.setLayoutParams(lp);
            }
            return WindowInsetsCompat.CONSUMED;
        });

        mealInput.requestFocus();
    }

    @Override
    public void onBackPressed() {
        if (barcodeOverlay != null && barcodeOverlay.getVisibility() == View.VISIBLE) {
            closeBarcodeOverlay();
        } else if (cameraMode) {
            exitCameraMode();
        } else {
            super.onBackPressed();
            finish();
        }
    }

    // ── Notification channel ───────────────────────────────────────────

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Meal Reminders", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("Meal logging and reminder notifications");
                ch.enableVibration(true);
                nm.createNotificationChannel(ch);
            }
        }
    }

    // ── Card UI ────────────────────────────────────────────────────────

    private void buildCardView() {
        float d = getResources().getDisplayMetrics().density;

        card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setOnClickListener(v -> {}); // consume clicks

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#CC111111"));
        bg.setCornerRadii(new float[]{24*d,24*d,24*d,24*d,0,0,0,0});
        card.setBackground(bg);
        card.setPadding(dp(20),dp(20),dp(20),dp(16));

        // Title
        card.addView(text("Quick Log", 20, true, "#FFFFFF", Gravity.CENTER), matchWrap());

        // Subtitle
        TextView sub = text("Type what you ate, or snap a photo", 13, false, "#9CA3AF", Gravity.CENTER);
        LinearLayout.LayoutParams subLp = matchWrap();
        subLp.topMargin = dp(4); subLp.bottomMargin = dp(16);
        card.addView(sub, subLp);

        // Photo preview (hidden)
        photoPreview = new ImageView(this);
        photoPreview.setScaleType(ImageView.ScaleType.CENTER_CROP);
        photoPreview.setVisibility(View.GONE);
        GradientDrawable prevBg = new GradientDrawable();
        prevBg.setColor(Color.parseColor("#1A1A1A"));
        prevBg.setCornerRadius(16*d);
        photoPreview.setBackground(prevBg);
        photoPreview.setClipToOutline(true);
        LinearLayout.LayoutParams prevLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(160));
        prevLp.bottomMargin = dp(10);
        card.addView(photoPreview, prevLp);

        photoLabel = new TextView(this);
        photoLabel.setVisibility(View.GONE);
        photoLabel.setTextColor(Color.parseColor("#7BA883"));
        photoLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        photoLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams plLp = matchWrap();
        plLp.bottomMargin = dp(8);
        card.addView(photoLabel, plLp);

        // Input row
        FrameLayout inputRow = new FrameLayout(this);
        GradientDrawable iBg = new GradientDrawable();
        iBg.setColor(Color.parseColor("#1A1A1A"));
        iBg.setCornerRadius(16*d);
        iBg.setStroke(dp(1), Color.parseColor("#333333"));
        inputRow.setBackground(iBg);

        mealInput = new EditText(this);
        mealInput.setHint("e.g. porridge with banana and peanut butter");
        mealInput.setHintTextColor(Color.parseColor("#666680"));
        mealInput.setTextColor(Color.WHITE);
        mealInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        mealInput.setBackground(null);
        mealInput.setPadding(dp(16),dp(14),dp(52),dp(14));
        mealInput.setMaxLines(3);
        mealInput.setImeOptions(EditorInfo.IME_ACTION_DONE);
        mealInput.addTextChangedListener(new TextWatcher() {
            public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            public void onTextChanged(CharSequence s, int a, int b, int c) {}
            public void afterTextChanged(Editable s) { updateSubmitState(); }
        });
        mealInput.setOnEditorActionListener((v, id, ev) -> {
            if (id == EditorInfo.IME_ACTION_DONE && canSubmit()) { submitMeal(); return true; }
            return false;
        });
        inputRow.addView(mealInput, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT));

        ImageButton camBtn = new ImageButton(this);
        camBtn.setImageResource(android.R.drawable.ic_menu_camera);
        camBtn.setColorFilter(Color.parseColor("#7BA883"));
        camBtn.setBackground(null);
        FrameLayout.LayoutParams camLp = new FrameLayout.LayoutParams(dp(44), dp(44));
        camLp.gravity = Gravity.END | Gravity.CENTER_VERTICAL;
        camLp.rightMargin = dp(6);
        camBtn.setOnClickListener(v -> onCameraTapped());
        inputRow.addView(camBtn, camLp);

        LinearLayout.LayoutParams irLp = matchWrap();
        irLp.bottomMargin = dp(14);
        card.addView(inputRow, irLp);

        // Meal type is auto-detected from time of day (no pills needed)

        // Submit
        submitBtn = text("Log Meal", 16, true, "#FFFFFF", Gravity.CENTER);
        submitBtn.setPadding(0,dp(15),0,dp(15));
        submitBtn.setOnClickListener(v -> submitMeal());
        card.addView(submitBtn, matchWrap());
        updateSubmitState();

        // Cancel
        TextView cancel = text("Cancel", 14, false, "#9CA3AF", Gravity.CENTER);
        cancel.setPadding(0,dp(12),0,dp(8));
        cancel.setOnClickListener(v -> finish());
        card.addView(cancel, matchWrap());

        FrameLayout.LayoutParams cardLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        cardLp.gravity = Gravity.BOTTOM;
        rootLayout.addView(card, cardLp);
    }

    // ── Camera UI (CameraX) ────────────────────────────────────────────

    private void buildCameraView() {
        cameraContainer = new FrameLayout(this);
        cameraContainer.setBackgroundColor(Color.BLACK);
        cameraContainer.setVisibility(View.GONE);

        // Live preview
        previewView = new PreviewView(this);
        previewView.setImplementationMode(PreviewView.ImplementationMode.PERFORMANCE);
        cameraContainer.addView(previewView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        float d = getResources().getDisplayMetrics().density;

        // Close button (top-right)
        ImageButton closeBtn = new ImageButton(this);
        closeBtn.setImageResource(android.R.drawable.ic_menu_close_clear_cancel);
        closeBtn.setColorFilter(Color.WHITE);
        GradientDrawable closeBg = new GradientDrawable();
        closeBg.setColor(Color.parseColor("#66000000"));
        closeBg.setCornerRadius(24*d);
        closeBtn.setBackground(closeBg);
        closeBtn.setPadding(dp(10),dp(10),dp(10),dp(10));
        closeBtn.setOnClickListener(v -> exitCameraMode());
        FrameLayout.LayoutParams closeLp = new FrameLayout.LayoutParams(dp(48),dp(48));
        closeLp.gravity = Gravity.TOP | Gravity.END;
        closeLp.topMargin = dp(52);
        closeLp.rightMargin = dp(16);
        cameraContainer.addView(closeBtn, closeLp);

        // Label
        TextView label = new TextView(this);
        label.setText("Take a photo of your meal");
        label.setTextColor(Color.WHITE);
        label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        label.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable labelBg = new GradientDrawable();
        labelBg.setColor(Color.parseColor("#66000000"));
        labelBg.setCornerRadius(20*d);
        label.setBackground(labelBg);
        label.setPadding(dp(16),dp(8),dp(16),dp(8));
        FrameLayout.LayoutParams labelLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        labelLp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        labelLp.topMargin = dp(56);
        cameraContainer.addView(label, labelLp);

        // Barcode detected banner (hidden by default)
        barcodeBanner = new TextView(this);
        barcodeBanner.setVisibility(View.GONE);
        barcodeBanner.setTextColor(Color.WHITE);
        barcodeBanner.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        barcodeBanner.setTypeface(Typeface.DEFAULT_BOLD);
        barcodeBanner.setGravity(Gravity.CENTER);
        GradientDrawable bannerBg = new GradientDrawable();
        bannerBg.setColor(Color.parseColor("#CC7BA883"));
        bannerBg.setCornerRadius(16*d);
        barcodeBanner.setBackground(bannerBg);
        barcodeBanner.setPadding(dp(20),dp(12),dp(20),dp(12));
        FrameLayout.LayoutParams bannerLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        bannerLp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        bannerLp.topMargin = dp(90);
        cameraContainer.addView(barcodeBanner, bannerLp);

        // Bottom gradient
        View gradient = new View(this);
        GradientDrawable gradBg = new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[]{Color.TRANSPARENT, Color.parseColor("#CC000000")});
        gradient.setBackground(gradBg);
        FrameLayout.LayoutParams gradLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, dp(160));
        gradLp.gravity = Gravity.BOTTOM;
        cameraContainer.addView(gradient, gradLp);

        // Bottom controls row
        LinearLayout controls = new LinearLayout(this);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        controls.setGravity(Gravity.CENTER_VERTICAL);

        // Spacer
        controls.addView(new View(this), new LinearLayout.LayoutParams(0,0,1f));

        // Capture button
        View captureBtn = new View(this);
        GradientDrawable capOuter = new GradientDrawable();
        capOuter.setShape(GradientDrawable.OVAL);
        capOuter.setStroke(dp(4), Color.WHITE);
        capOuter.setColor(Color.parseColor("#33FFFFFF"));
        captureBtn.setBackground(capOuter);
        captureBtn.setOnClickListener(v -> capturePhoto());
        LinearLayout.LayoutParams capLp = new LinearLayout.LayoutParams(dp(72),dp(72));
        controls.addView(captureBtn, capLp);

        // Flip camera button
        View flipSpacer = new View(this);
        controls.addView(flipSpacer, new LinearLayout.LayoutParams(0,0,0.6f));
        ImageButton flipBtn = new ImageButton(this);
        flipBtn.setImageResource(android.R.drawable.ic_menu_rotate);
        flipBtn.setColorFilter(Color.WHITE);
        GradientDrawable flipBg = new GradientDrawable();
        flipBg.setColor(Color.parseColor("#66000000"));
        flipBg.setCornerRadius(24*d);
        flipBtn.setBackground(flipBg);
        flipBtn.setPadding(dp(10),dp(10),dp(10),dp(10));
        flipBtn.setOnClickListener(v -> flipCamera());
        LinearLayout.LayoutParams flipLp = new LinearLayout.LayoutParams(dp(48),dp(48));
        controls.addView(flipBtn, flipLp);
        controls.addView(new View(this), new LinearLayout.LayoutParams(0,0,0.4f));

        FrameLayout.LayoutParams ctrlLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        ctrlLp.gravity = Gravity.BOTTOM;
        ctrlLp.bottomMargin = dp(40);
        cameraContainer.addView(controls, ctrlLp);

        rootLayout.addView(cameraContainer, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    }

    // ── Camera mode transitions ────────────────────────────────────────

    private void onCameraTapped() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) {
            enterCameraMode();
        } else {
            cameraPermLauncher.launch(Manifest.permission.CAMERA);
        }
    }

    private void enterCameraMode() {
        cameraMode = true;
        card.setVisibility(View.GONE);
        cameraContainer.setVisibility(View.VISIBLE);
        rootLayout.setBackgroundColor(Color.BLACK);

        // Hide keyboard
        InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (imm != null) imm.hideSoftInputFromWindow(mealInput.getWindowToken(), 0);

        // Go full immersive
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (c != null) {
            c.hide(WindowInsetsCompat.Type.systemBars());
            c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }

        startCamera();
    }

    private void exitCameraMode() {
        cameraMode = false;
        cameraContainer.setVisibility(View.GONE);
        card.setVisibility(View.VISIBLE);
        rootLayout.setBackgroundColor(Color.parseColor("#99000000"));

        // Restore system bars
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (c != null) {
            c.show(WindowInsetsCompat.Type.systemBars());
        }

        stopCamera();
    }

    // ── CameraX ────────────────────────────────────────────────────────

    private void startCamera() {
        ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(this);
        future.addListener(() -> {
            try {
                ProcessCameraProvider provider = future.get();
                bindCamera(provider);
            } catch (ExecutionException | InterruptedException e) {
                exitCameraMode();
            }
        }, ContextCompat.getMainExecutor(this));
    }

    @SuppressLint("UnsafeOptInUsageError")
    private void bindCamera(ProcessCameraProvider provider) {
        provider.unbindAll();
        lastDetectedBarcode = null;
        if (barcodeBanner != null) runOnUiThread(() -> barcodeBanner.setVisibility(View.GONE));

        Preview preview = new Preview.Builder().build();
        preview.setSurfaceProvider(previewView.getSurfaceProvider());

        imageCapture = new ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
            .build();

        // Barcode scanning via ML Kit on every ~N-th frame
        ImageAnalysis analysis = new ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build();
        analysis.setAnalyzer(ContextCompat.getMainExecutor(this), imageProxy -> {
            @SuppressLint("UnsafeOptInUsageError")
            android.media.Image mediaImage = imageProxy.getImage();
            if (mediaImage == null) { imageProxy.close(); return; }
            InputImage inputImage = InputImage.fromMediaImage(mediaImage,
                imageProxy.getImageInfo().getRotationDegrees());
            barcodeScanner.process(inputImage)
                .addOnSuccessListener(barcodes -> {
                    if (!barcodes.isEmpty()) {
                        String code = barcodes.get(0).getRawValue();
                        if (code != null && !code.equals(lastDetectedBarcode)) {
                            lastDetectedBarcode = code;
                            onBarcodeDetected(code);
                        }
                    }
                })
                .addOnCompleteListener(task -> imageProxy.close());
        });

        CameraSelector selector = new CameraSelector.Builder()
            .requireLensFacing(lensFacing)
            .build();

        provider.bindToLifecycle(this, selector, preview, imageCapture, analysis);
    }

    private void onBarcodeDetected(String code) {
        runOnUiThread(() -> {
            barcodeBanner.setText("Looking up barcode...");
            barcodeBanner.setVisibility(View.VISIBLE);
        });

        // Fetch product info from OpenFoodFacts on background thread
        new Thread(() -> {
            try {
                String url = "https://world.openfoodfacts.org/api/v2/product/"
                    + java.net.URLEncoder.encode(code, "UTF-8") + ".json";
                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(10_000);
                conn.setReadTimeout(10_000);
                int status = conn.getResponseCode();
                if (status < 200 || status >= 300) {
                    showBarcodeFallback(code);
                    conn.disconnect();
                    return;
                }
                BufferedReader r = new BufferedReader(
                    new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
                r.close();
                conn.disconnect();

                JSONObject resp = new JSONObject(sb.toString());
                if (resp.optInt("status", 0) != 1 || !resp.has("product")) {
                    showBarcodeFallback(code);
                    return;
                }

                JSONObject product = resp.getJSONObject("product");
                JSONObject nutrients = product.optJSONObject("nutriments");
                if (nutrients == null) { showBarcodeFallback(code); return; }

                // Build product data object
                JSONObject data = new JSONObject();
                data.put("name", product.optString("product_name", "Unknown Product"));
                data.put("brand", product.optString("brands", ""));
                data.put("quantity", product.optString("quantity", ""));
                data.put("barcode", code);
                data.put("image", product.optString("image_front_small_url", ""));

                String servingSizeStr = product.optString("serving_size", "");
                data.put("servingSize", servingSizeStr);
                // Parse serving weight
                double servingWeightG = 0;
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("([\\d.]+)\\s*(g|ml)", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(servingSizeStr);
                if (m.find()) servingWeightG = Double.parseDouble(m.group(1));
                data.put("servingWeightG", servingWeightG);

                // Per-serving macros
                JSONObject perServing = new JSONObject();
                perServing.put("calories", nutrients.optDouble("energy-kcal_serving", 0));
                perServing.put("protein_g", nutrients.optDouble("proteins_serving", 0));
                perServing.put("carbs_g", nutrients.optDouble("carbohydrates_serving", 0));
                perServing.put("fat_g", nutrients.optDouble("fat_serving", 0));
                perServing.put("fiber_g", nutrients.optDouble("fiber_serving", 0));
                perServing.put("sugars_g", nutrients.optDouble("sugars_serving", 0));
                perServing.put("sodium_mg", nutrients.optDouble("sodium_serving", 0) * 1000);
                data.put("perServing", perServing);

                // Per-100g macros
                JSONObject per100g = new JSONObject();
                per100g.put("calories", nutrients.optDouble("energy-kcal_100g", 0));
                per100g.put("protein_g", nutrients.optDouble("proteins_100g", 0));
                per100g.put("carbs_g", nutrients.optDouble("carbohydrates_100g", 0));
                per100g.put("fat_g", nutrients.optDouble("fat_100g", 0));
                per100g.put("fiber_g", nutrients.optDouble("fiber_100g", 0));
                per100g.put("sugars_g", nutrients.optDouble("sugars_100g", 0));
                per100g.put("sodium_mg", nutrients.optDouble("sodium_100g", 0) * 1000);
                data.put("per100g", per100g);

                // Determine if per-serving data exists
                boolean hasServing = perServing.optDouble("calories", 0) > 0;
                data.put("isPerServing", hasServing);

                mainHandler.post(() -> showBarcodeProductOverlay(data));

            } catch (Exception e) {
                showBarcodeFallback(code);
            }
        }).start();
    }

    /** Fallback when barcode not found — just pre-fill the text field */
    private void showBarcodeFallback(String code) {
        mainHandler.post(() -> {
            barcodeBanner.setText("Not found: " + code);
            barcodeBanner.setVisibility(View.VISIBLE);
            mealInput.setText("Barcode: " + code);
            // Reset after 3 seconds so user can scan again
            mainHandler.postDelayed(() -> {
                lastDetectedBarcode = null;
                barcodeBanner.setVisibility(View.GONE);
            }, 3000);
        });
    }

    // ── Barcode product overlay ────────────────────────────────────────

    private void buildBarcodeOverlay() {
        float d = getResources().getDisplayMetrics().density;

        barcodeOverlay = new FrameLayout(this);
        barcodeOverlay.setBackgroundColor(Color.parseColor("#D9000000"));
        barcodeOverlay.setVisibility(View.GONE);
        barcodeOverlay.setClickable(true); // consume touches

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(20), dp(60), dp(20), dp(32));

        // Card container
        LinearLayout cardBg = new LinearLayout(this);
        cardBg.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable cardShape = new GradientDrawable();
        cardShape.setColor(Color.parseColor("#1E1E2E"));
        cardShape.setCornerRadius(20 * d);
        cardBg.setBackground(cardShape);
        cardBg.setPadding(dp(24), dp(24), dp(24), dp(24));

        // Product name
        barcodeProductName = new TextView(this);
        barcodeProductName.setTextColor(Color.WHITE);
        barcodeProductName.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        barcodeProductName.setTypeface(Typeface.DEFAULT_BOLD);
        cardBg.addView(barcodeProductName, matchWrapLinear());

        // Brand
        barcodeProductBrand = new TextView(this);
        barcodeProductBrand.setTextColor(Color.parseColor("#888888"));
        barcodeProductBrand.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        LinearLayout.LayoutParams brandLp = matchWrapLinear();
        brandLp.topMargin = dp(4); brandLp.bottomMargin = dp(16);
        cardBg.addView(barcodeProductBrand, brandLp);

        // Servings row
        LinearLayout servRow = new LinearLayout(this);
        servRow.setOrientation(LinearLayout.HORIZONTAL);
        servRow.setGravity(Gravity.CENTER_VERTICAL);

        TextView minusBtn = pill("\u2212", "#333333");
        minusBtn.setOnClickListener(v -> adjustServings(-0.5));
        servRow.addView(minusBtn, new LinearLayout.LayoutParams(dp(44), dp(44)));

        barcodeServingsDisplay = new TextView(this);
        barcodeServingsDisplay.setTextColor(Color.WHITE);
        barcodeServingsDisplay.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        barcodeServingsDisplay.setTypeface(Typeface.DEFAULT_BOLD);
        barcodeServingsDisplay.setGravity(Gravity.CENTER);
        barcodeServingsDisplay.setText("1");
        LinearLayout.LayoutParams sdLp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        servRow.addView(barcodeServingsDisplay, sdLp);

        TextView plusBtn = pill("+", "#333333");
        plusBtn.setOnClickListener(v -> adjustServings(0.5));
        servRow.addView(plusBtn, new LinearLayout.LayoutParams(dp(44), dp(44)));

        LinearLayout.LayoutParams srLp = matchWrapLinear();
        srLp.bottomMargin = dp(4);
        cardBg.addView(servRow, srLp);

        barcodeServingLabel = new TextView(this);
        barcodeServingLabel.setTextColor(Color.parseColor("#888888"));
        barcodeServingLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        barcodeServingLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams slLp = matchWrapLinear();
        slLp.bottomMargin = dp(20);
        cardBg.addView(barcodeServingLabel, slLp);

        // Macro grid (2x2)
        LinearLayout macroGrid = new LinearLayout(this);
        macroGrid.setOrientation(LinearLayout.VERTICAL);

        LinearLayout row1 = new LinearLayout(this);
        row1.setOrientation(LinearLayout.HORIZONTAL);
        barcodeCaloriesVal = addMacroCard(row1, "Calories", "#22c55e");
        barcodeProteinVal = addMacroCard(row1, "Protein", "#3b82f6");
        macroGrid.addView(row1, matchWrapLinear());

        LinearLayout row2 = new LinearLayout(this);
        row2.setOrientation(LinearLayout.HORIZONTAL);
        barcodeCarbsVal = addMacroCard(row2, "Carbs", "#f59e0b");
        barcodeFatVal = addMacroCard(row2, "Fat", "#ef4444");
        LinearLayout.LayoutParams r2Lp = matchWrapLinear();
        r2Lp.topMargin = dp(8);
        macroGrid.addView(row2, r2Lp);

        LinearLayout.LayoutParams mgLp = matchWrapLinear();
        mgLp.bottomMargin = dp(12);
        cardBg.addView(macroGrid, mgLp);

        // Extra nutrients row
        barcodeExtrasRow = new LinearLayout(this);
        barcodeExtrasRow.setOrientation(LinearLayout.HORIZONTAL);
        barcodeExtrasRow.setGravity(Gravity.CENTER);

        barcodeFiberVal = addExtraChip(barcodeExtrasRow, "Fiber");
        barcodeSugarVal = addExtraChip(barcodeExtrasRow, "Sugar");
        barcodeSodiumVal = addExtraChip(barcodeExtrasRow, "Sodium");

        LinearLayout.LayoutParams exLp = matchWrapLinear();
        exLp.bottomMargin = dp(20);
        cardBg.addView(barcodeExtrasRow, exLp);

        // Log Meal button
        barcodeLogBtn = new TextView(this);
        barcodeLogBtn.setText("Log Meal");
        barcodeLogBtn.setTextColor(Color.WHITE);
        barcodeLogBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        barcodeLogBtn.setTypeface(Typeface.DEFAULT_BOLD);
        barcodeLogBtn.setGravity(Gravity.CENTER);
        barcodeLogBtn.setPadding(0, dp(15), 0, dp(15));
        GradientDrawable logBg = new GradientDrawable();
        logBg.setColor(Color.parseColor("#7BA883"));
        logBg.setCornerRadius(16 * d);
        barcodeLogBtn.setBackground(logBg);
        barcodeLogBtn.setOnClickListener(v -> logBarcodeMeal());
        cardBg.addView(barcodeLogBtn, matchWrapLinear());

        // Cancel button
        TextView cancelBtn = new TextView(this);
        cancelBtn.setText("Cancel");
        cancelBtn.setTextColor(Color.parseColor("#9CA3AF"));
        cancelBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        cancelBtn.setGravity(Gravity.CENTER);
        cancelBtn.setPadding(0, dp(14), 0, dp(8));
        cancelBtn.setOnClickListener(v -> closeBarcodeOverlay());
        cardBg.addView(cancelBtn, matchWrapLinear());

        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        cardLp.leftMargin = dp(4); cardLp.rightMargin = dp(4);
        content.addView(cardBg, cardLp);

        scroll.addView(content, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        barcodeOverlay.addView(scroll, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        rootLayout.addView(barcodeOverlay, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    }

    private TextView addMacroCard(LinearLayout row, String label, String color) {
        float d = getResources().getDisplayMetrics().density;
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER);
        card.setPadding(dp(12), dp(14), dp(12), dp(14));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor(color + "1A")); // ~10% opacity
        bg.setCornerRadius(14 * d);
        bg.setStroke(dp(1), Color.parseColor(color + "33"));
        card.setBackground(bg);

        TextView val = new TextView(this);
        val.setTextColor(Color.parseColor(color));
        val.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        val.setTypeface(Typeface.DEFAULT_BOLD);
        val.setGravity(Gravity.CENTER);
        val.setText("0");
        card.addView(val, matchWrapLinear());

        TextView lbl = new TextView(this);
        lbl.setText(label);
        lbl.setTextColor(Color.parseColor("#AAAAAA"));
        lbl.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        lbl.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams lblLp = matchWrapLinear();
        lblLp.topMargin = dp(2);
        card.addView(lbl, lblLp);

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        lp.leftMargin = dp(4); lp.rightMargin = dp(4);
        row.addView(card, lp);
        return val;
    }

    private TextView addExtraChip(LinearLayout row, String label) {
        float d = getResources().getDisplayMetrics().density;
        TextView chip = new TextView(this);
        chip.setTextColor(Color.parseColor("#999999"));
        chip.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        chip.setGravity(Gravity.CENTER);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#1A1A2E"));
        bg.setCornerRadius(10 * d);
        chip.setBackground(bg);
        chip.setPadding(dp(12), dp(8), dp(12), dp(8));
        // Tag to identify which extra this is
        chip.setTag(label);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        lp.leftMargin = dp(4); lp.rightMargin = dp(4);
        row.addView(chip, lp);
        return chip;
    }

    private TextView pill(String text, String bgColor) {
        float d = getResources().getDisplayMetrics().density;
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextColor(Color.WHITE);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        tv.setTypeface(Typeface.DEFAULT_BOLD);
        tv.setGravity(Gravity.CENTER);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor(bgColor));
        bg.setCornerRadius(22 * d);
        tv.setBackground(bg);
        return tv;
    }

    private LinearLayout.LayoutParams matchWrapLinear() {
        return new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private void showBarcodeProductOverlay(JSONObject data) {
        barcodeProductData = data;
        barcodeServings = 1;

        // Exit camera mode first
        exitCameraMode();

        String name = data.optString("name", "Unknown Product");
        String brand = data.optString("brand", "");
        String servSize = data.optString("servingSize", "");

        barcodeProductName.setText(name);
        barcodeProductBrand.setText(brand.isEmpty() ? "Scanned product" : brand);
        barcodeServingsDisplay.setText("1");
        barcodeServingLabel.setText(servSize.isEmpty() ? "serving" : servSize + " per serving");

        updateBarcodeNutritionDisplay();

        barcodeOverlay.setVisibility(View.VISIBLE);
    }

    private void closeBarcodeOverlay() {
        barcodeOverlay.setVisibility(View.GONE);
        barcodeProductData = null;
        barcodeServings = 1;
        lastDetectedBarcode = null;
    }

    private void adjustServings(double delta) {
        barcodeServings = Math.max(0.5, barcodeServings + delta);
        // Format display — show integer if whole number, else 1 decimal
        if (barcodeServings == Math.floor(barcodeServings)) {
            barcodeServingsDisplay.setText(String.valueOf((int) barcodeServings));
        } else {
            barcodeServingsDisplay.setText(String.format(java.util.Locale.US, "%.1f", barcodeServings));
        }
        updateBarcodeNutritionDisplay();
    }

    private void updateBarcodeNutritionDisplay() {
        if (barcodeProductData == null) return;

        try {
            boolean hasServing = barcodeProductData.optBoolean("isPerServing", false);
            JSONObject per = hasServing
                ? barcodeProductData.getJSONObject("perServing")
                : barcodeProductData.getJSONObject("per100g");
            double mult = barcodeServings;

            int cal = (int) Math.round(per.optDouble("calories", 0) * mult);
            int prot = (int) Math.round(per.optDouble("protein_g", 0) * mult);
            int carbs = (int) Math.round(per.optDouble("carbs_g", 0) * mult);
            int fat = (int) Math.round(per.optDouble("fat_g", 0) * mult);

            barcodeCaloriesVal.setText(String.valueOf(cal));
            barcodeProteinVal.setText(prot + "g");
            barcodeCarbsVal.setText(carbs + "g");
            barcodeFatVal.setText(fat + "g");

            // Extras
            double fiber = per.optDouble("fiber_g", 0) * mult;
            double sugar = per.optDouble("sugars_g", 0) * mult;
            double sodium = per.optDouble("sodium_mg", 0) * mult;

            barcodeFiberVal.setText("Fiber " + (int) Math.round(fiber) + "g");
            barcodeSugarVal.setText("Sugar " + (int) Math.round(sugar) + "g");
            barcodeSodiumVal.setText("Sodium " + (int) Math.round(sodium) + "mg");
        } catch (Exception e) {
            // Silently ignore — display stays at last known values
        }
    }

    private void logBarcodeMeal() {
        if (barcodeProductData == null) return;

        try {
            boolean hasServing = barcodeProductData.optBoolean("isPerServing", false);
            JSONObject per = hasServing
                ? barcodeProductData.getJSONObject("perServing")
                : barcodeProductData.getJSONObject("per100g");
            double mult = barcodeServings;

            String name = barcodeProductData.optString("name", "Unknown");
            String brand = barcodeProductData.optString("brand", "");
            String barcode = barcodeProductData.optString("barcode", "");

            // Build portion string
            String portion;
            if (hasServing) {
                String servSize = barcodeProductData.optString("servingSize", "");
                portion = (barcodeServings == 1 ? "1 serving" : barcodeServings + " servings")
                    + (servSize.isEmpty() ? "" : " (" + servSize + ")");
            } else {
                portion = (int)(100 * barcodeServings) + "g";
            }

            int cal = (int) Math.round(per.optDouble("calories", 0) * mult);
            double prot = Math.round(per.optDouble("protein_g", 0) * mult * 10) / 10.0;
            double carbs = Math.round(per.optDouble("carbs_g", 0) * mult * 10) / 10.0;
            double fat = Math.round(per.optDouble("fat_g", 0) * mult * 10) / 10.0;
            double fiber = Math.round(per.optDouble("fiber_g", 0) * mult * 10) / 10.0;

            String fullName = name + (brand.isEmpty() ? "" : " (" + brand + ")");

            // Build analysis result matching the format saveMealLogWithType expects
            JSONObject foodItem = new JSONObject();
            foodItem.put("name", fullName);
            foodItem.put("portion", portion);
            foodItem.put("calories", cal);
            foodItem.put("protein_g", prot);
            foodItem.put("carbs_g", carbs);
            foodItem.put("fat_g", fat);
            foodItem.put("fiber_g", fiber);

            JSONArray foodItems = new JSONArray();
            foodItems.put(foodItem);

            JSONObject totals = new JSONObject();
            totals.put("calories", cal);
            totals.put("protein_g", prot);
            totals.put("carbs_g", carbs);
            totals.put("fat_g", fat);
            totals.put("fiber_g", fiber);

            JSONObject analysisResult = new JSONObject();
            analysisResult.put("foodItems", foodItems);
            analysisResult.put("totals", totals);
            analysisResult.put("confidence", "high");
            analysisResult.put("inputMethod", "barcode");
            analysisResult.put("notes", "Barcode scan: " + barcode);

            closeBarcodeOverlay();
            finish(); // close activity instantly

            // Show notification with results
            showNotification(
                "Meal Logged \u2014 " + cal + " cal",
                fullName + "\nP " + (int)prot + "g  \u2022  C " + (int)carbs + "g  \u2022  F " + (int)fat + "g"
            );

            // Save for WebView to persist to Supabase
            JSONObject pending = new JSONObject();
            pending.put("description", fullName);
            pending.put("mealType", selectedMealType);
            pending.put("hasPhoto", false);
            pending.put("analysisResult", analysisResult.toString());
            pending.put("inputMethod", "barcode");
            pending.put("timestamp", System.currentTimeMillis());

            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            prefs.edit().putString(KEY_PENDING, pending.toString()).apply();

        } catch (Exception e) {
            showNotification("Meal Log", "Failed to log barcode meal. Open the app to try again.");
        }
    }

    private void stopCamera() {
        try {
            ProcessCameraProvider.getInstance(this).get().unbindAll();
        } catch (Exception ignored) {}
    }

    private void flipCamera() {
        lensFacing = (lensFacing == CameraSelector.LENS_FACING_BACK)
            ? CameraSelector.LENS_FACING_FRONT : CameraSelector.LENS_FACING_BACK;
        startCamera();
    }

    @SuppressLint("RestrictedApi")
    private void capturePhoto() {
        if (imageCapture == null) return;

        imageCapture.takePicture(ContextCompat.getMainExecutor(this),
            new ImageCapture.OnImageCapturedCallback() {
                @Override
                public void onCaptureSuccess(@NonNull ImageProxy image) {
                    // Convert ImageProxy to Bitmap on background thread
                    new Thread(() -> {
                        try {
                            Bitmap bmp = imageProxyToBitmap(image);
                            image.close();
                            if (bmp == null) return;

                            // Downscale
                            int maxW = 1024;
                            if (bmp.getWidth() > maxW) {
                                int h = (int)(bmp.getHeight() * (float)maxW / bmp.getWidth());
                                Bitmap s = Bitmap.createScaledBitmap(bmp, maxW, h, true);
                                bmp.recycle(); bmp = s;
                            }

                            ByteArrayOutputStream baos = new ByteArrayOutputStream();
                            bmp.compress(Bitmap.CompressFormat.JPEG, 80, baos);
                            byte[] bytes = baos.toByteArray();
                            capturedPhotoBase64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
                            final Bitmap prev = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                            bmp.recycle();

                            runOnUiThread(() -> {
                                exitCameraMode();
                                if (prev != null) {
                                    photoPreview.setImageBitmap(prev);
                                    photoPreview.setVisibility(View.VISIBLE);
                                    photoLabel.setText("Photo attached — add a description for better accuracy");
                                    photoLabel.setVisibility(View.VISIBLE);
                                }
                                updateSubmitState();
                            });
                        } catch (Exception e) {
                            runOnUiThread(() -> exitCameraMode());
                        }
                    }).start();
                }

                @Override
                public void onError(@NonNull ImageCaptureException e) {
                    runOnUiThread(() -> exitCameraMode());
                }
            });
    }

    private Bitmap imageProxyToBitmap(ImageProxy image) {
        ByteBuffer buffer = image.getPlanes()[0].getBuffer();
        byte[] bytes = new byte[buffer.remaining()];
        buffer.get(bytes);
        Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        if (bmp == null) return null;

        // Apply rotation from image metadata
        int rotation = image.getImageInfo().getRotationDegrees();
        if (rotation != 0) {
            Matrix matrix = new Matrix();
            matrix.postRotate(rotation);
            Bitmap rotated = Bitmap.createBitmap(bmp, 0, 0, bmp.getWidth(), bmp.getHeight(), matrix, true);
            bmp.recycle();
            return rotated;
        }
        return bmp;
    }

    // ── Submit state ───────────────────────────────────────────────────

    private boolean canSubmit() {
        return mealInput.getText().toString().trim().length() >= 3
            || capturedPhotoBase64 != null;
    }

    private void updateSubmitState() {
        boolean ok = canSubmit();
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(16));
        bg.setColor(Color.parseColor(ok ? "#7BA883" : "#333333"));
        submitBtn.setBackground(bg);
        submitBtn.setAlpha(ok ? 1f : 0.5f);
        submitBtn.setEnabled(ok);
    }

    // ── Submit ─────────────────────────────────────────────────────────

    private void submitMeal() {
        if (!canSubmit()) return;

        final String description = mealInput.getText().toString().trim();
        final String mealType = selectedMealType;
        final String photoB64 = capturedPhotoBase64;

        finish(); // close overlay instantly

        new Thread(() -> {
            final int MAX_ATTEMPTS = 2;
            for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                try {
                    String responseBody;
                    if (photoB64 != null) {
                        responseBody = callAnalyzeFood(photoB64, description);
                    } else {
                        responseBody = callAnalyzeMealText(description, mealType);
                    }

                    JSONObject resp = new JSONObject(responseBody);
                    if (!resp.optBoolean("success", false)) {
                        if (attempt < MAX_ATTEMPTS) {
                            Thread.sleep(2000);
                            continue;
                        }
                        showNotification("Meal Log Failed",
                            "Could not analyse your meal. Open the app to try again.");
                        return;
                    }

                    JSONObject data = resp.getJSONObject("data");
                    JSONObject totals = data.optJSONObject("totals");
                    String notes = data.optString("notes", "");

                    // Build meal name
                    String mealName = notes;
                    if (mealName.isEmpty()) {
                        JSONArray items = data.optJSONArray("foodItems");
                        if (items != null && items.length() > 0) {
                            StringBuilder sb = new StringBuilder();
                            for (int i = 0; i < Math.min(items.length(), 3); i++) {
                                if (i > 0) sb.append(", ");
                                sb.append(items.getJSONObject(i).optString("name", ""));
                            }
                            if (items.length() > 3) sb.append(" + more");
                            mealName = sb.toString();
                        }
                    }
                    if (mealName.isEmpty()) mealName = description;

                    int cal = totals != null ? (int) Math.round(totals.optDouble("calories", 0)) : 0;
                    int protein = totals != null ? (int) Math.round(totals.optDouble("protein_g", 0)) : 0;
                    int carbs = totals != null ? (int) Math.round(totals.optDouble("carbs_g", 0)) : 0;
                    int fat = totals != null ? (int) Math.round(totals.optDouble("fat_g", 0)) : 0;

                    showNotification(
                        "Meal Logged — " + cal + " cal",
                        mealName + "\nP " + protein + "g  •  C " + carbs + "g  •  F " + fat + "g"
                    );

                    // Save for WebView to persist to Supabase
                    JSONObject pending = new JSONObject();
                    pending.put("description", description);
                    pending.put("mealType", mealType);
                    pending.put("hasPhoto", photoB64 != null);
                    pending.put("analysisResult", data.toString());
                    pending.put("timestamp", System.currentTimeMillis());

                    SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                    prefs.edit().putString(KEY_PENDING, pending.toString()).apply();
                    return; // success — exit retry loop

                } catch (java.net.SocketTimeoutException e) {
                    if (attempt < MAX_ATTEMPTS) {
                        try { Thread.sleep(2000); } catch (InterruptedException ignored) {}
                        continue;
                    }
                    showNotification("Meal Log",
                        "Analysing your meal took too long. Open the app to try again.");
                } catch (java.io.IOException e) {
                    if (attempt < MAX_ATTEMPTS) {
                        try { Thread.sleep(2000); } catch (InterruptedException ignored) {}
                        continue;
                    }
                    showNotification("Meal Log",
                        "Network error logging your meal. Open the app to try again.");
                } catch (Exception e) {
                    showNotification("Meal Log Failed",
                        "Could not analyse your meal. Open the app to try again.");
                    return; // non-retriable error — don't retry
                }
            }
        }).start();
    }

    // ── Netlify API ────────────────────────────────────────────────────

    private String callAnalyzeMealText(String desc, String type) throws Exception {
        JSONObject body = new JSONObject();
        body.put("description", desc);
        body.put("mealType", type);
        return httpPost(API_BASE + "/analyze-meal-text", body.toString());
    }

    private String callAnalyzeFood(String base64, String desc) throws Exception {
        JSONObject body = new JSONObject();
        body.put("imageBase64", base64);
        body.put("mimeType", "image/jpeg");
        body.put("description", desc);
        return httpPost(API_BASE + "/analyze-food", body.toString());
    }

    private String httpPost(String urlStr, String jsonBody) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(30_000);
        conn.setReadTimeout(60_000);
        try (OutputStream os = conn.getOutputStream()) {
            os.write(jsonBody.getBytes(StandardCharsets.UTF_8));
        }
        int code = conn.getResponseCode();
        InputStream is = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
        BufferedReader r = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) sb.append(line);
        r.close(); conn.disconnect();
        return sb.toString();
    }

    // ── Notification ───────────────────────────────────────────────────

    private void showNotification(String title, String body) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        int icon = getResources().getIdentifier("ic_stat_notification", "drawable", getPackageName());
        if (icon == 0) icon = android.R.drawable.ic_dialog_info;
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(icon)
            .setContentTitle(title)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true);
        nm.notify(9000 + (int)(System.currentTimeMillis() % 1000), b.build());
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    private int dp(float v) { return (int)(v * getResources().getDisplayMetrics().density); }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private TextView text(String t, float sp, boolean bold, String color, int gravity) {
        TextView tv = new TextView(this);
        tv.setText(t);
        tv.setTextColor(Color.parseColor(color));
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        if (bold) tv.setTypeface(Typeface.DEFAULT_BOLD);
        tv.setGravity(gravity);
        return tv;
    }
}
