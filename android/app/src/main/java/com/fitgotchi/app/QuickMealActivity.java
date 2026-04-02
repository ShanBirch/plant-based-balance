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

        // Build both UIs — only one visible at a time
        buildCameraView();
        buildCardView();

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
        if (cameraMode) {
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
            barcodeBanner.setText("Barcode found! Looking up...");
            barcodeBanner.setVisibility(View.VISIBLE);
        });

        // Look up barcode on OpenFoodFacts in background, save directly (no Gemini)
        new Thread(() -> {
            try {
                String url = "https://world.openfoodfacts.org/api/v2/product/"
                    + java.net.URLEncoder.encode(code, "UTF-8") + ".json";
                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(10_000);
                conn.setReadTimeout(15_000);
                int status = conn.getResponseCode();
                if (status < 200 || status >= 300) {
                    runOnUiThread(() -> {
                        barcodeBanner.setText("Product not found — type it instead");
                        mealInput.setText("Barcode: " + code);
                    });
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
                    runOnUiThread(() -> {
                        barcodeBanner.setText("Product not in database — type it instead");
                        mealInput.setText("Barcode: " + code);
                    });
                    return;
                }

                JSONObject product = resp.getJSONObject("product");
                JSONObject n = product.optJSONObject("nutriments");
                if (n == null) n = new JSONObject();

                String productName = product.optString("product_name",
                    product.optString("product_name_en", "Unknown Product"));
                String brand = product.optString("brands", "");
                String servingSize = product.optString("serving_size", "");

                // Use per-serving values if available, otherwise per-100g
                boolean hasServing = n.has("energy-kcal_serving");
                String suffix = hasServing ? "_serving" : "_100g";

                double cal = n.optDouble("energy-kcal" + suffix, 0);
                double protein = n.optDouble("proteins" + suffix, 0);
                double carbs = n.optDouble("carbohydrates" + suffix, 0);
                double fat = n.optDouble("fat" + suffix, 0);
                double fiber = n.optDouble("fiber" + suffix, 0);

                String portion = hasServing
                    ? "1 serving" + (servingSize.isEmpty() ? "" : " (" + servingSize + ")")
                    : "100g";

                String displayName = productName + (brand.isEmpty() ? "" : " (" + brand + ")");

                // Build analysis result in the same shape the WebView expects
                JSONObject foodItem = new JSONObject();
                foodItem.put("name", displayName);
                foodItem.put("portion", portion);
                foodItem.put("calories", Math.round(cal));
                foodItem.put("protein_g", Math.round(protein * 10.0) / 10.0);
                foodItem.put("carbs_g", Math.round(carbs * 10.0) / 10.0);
                foodItem.put("fat_g", Math.round(fat * 10.0) / 10.0);
                foodItem.put("fiber_g", Math.round(fiber * 10.0) / 10.0);

                JSONArray foodItems = new JSONArray();
                foodItems.put(foodItem);

                JSONObject totals = new JSONObject();
                totals.put("calories", Math.round(cal));
                totals.put("protein_g", Math.round(protein * 10.0) / 10.0);
                totals.put("carbs_g", Math.round(carbs * 10.0) / 10.0);
                totals.put("fat_g", Math.round(fat * 10.0) / 10.0);
                totals.put("fiber_g", Math.round(fiber * 10.0) / 10.0);

                // Micronutrients from per-100g (always available)
                JSONObject micro = new JSONObject();
                micro.put("vitamin_c_mg", n.optDouble("vitamin-c_100g", 0));
                micro.put("iron_mg", n.optDouble("iron_100g", 0));
                micro.put("calcium_mg", n.optDouble("calcium_100g", 0));
                micro.put("potassium_mg", n.optDouble("potassium_100g", 0));
                micro.put("vitamin_a_mcg", n.optDouble("vitamin-a_100g", 0));
                micro.put("vitamin_d_mcg", n.optDouble("vitamin-d_100g", 0));
                micro.put("b12_mcg", 0); micro.put("omega3_g", 0);
                micro.put("zinc_mg", 0); micro.put("iodine_mcg", 0);
                micro.put("selenium_mcg", 0); micro.put("folate_mcg", 0);
                micro.put("magnesium_mg", 0); micro.put("vitamin_e_mg", 0);
                micro.put("vitamin_k_mcg", 0);

                JSONObject analysisResult = new JSONObject();
                analysisResult.put("foodItems", foodItems);
                analysisResult.put("totals", totals);
                analysisResult.put("micronutrients", micro);
                analysisResult.put("confidence", "high");
                analysisResult.put("notes", "Barcode scan: " + code);

                // Show notification with macros
                showNotification(
                    "Meal Logged — " + Math.round(cal) + " cal",
                    displayName + "\nP " + Math.round(protein) + "g  •  C "
                        + Math.round(carbs) + "g  •  F " + Math.round(fat) + "g"
                );

                // Save for WebView to persist to Supabase
                JSONObject pending = new JSONObject();
                pending.put("description", "Barcode scan: " + code);
                pending.put("mealType", selectedMealType);
                pending.put("hasPhoto", false);
                pending.put("inputMethod", "barcode");
                pending.put("analysisResult", analysisResult.toString());
                pending.put("timestamp", System.currentTimeMillis());

                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                prefs.edit().putString(KEY_PENDING, pending.toString()).apply();

                finish(); // close overlay — meal is saved

            } catch (Exception e) {
                runOnUiThread(() -> {
                    barcodeBanner.setText("Lookup failed — type it instead");
                    mealInput.setText("Barcode: " + code);
                });
            }
        }).start();
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
                    savePendingForReanalysis(description, mealType, photoB64 != null);
                    showNotification("Meal Log",
                        "Analysing your meal took too long. It will be re-analysed when you open the app.");
                } catch (java.io.IOException e) {
                    if (attempt < MAX_ATTEMPTS) {
                        try { Thread.sleep(2000); } catch (InterruptedException ignored) {}
                        continue;
                    }
                    savePendingForReanalysis(description, mealType, photoB64 != null);
                    showNotification("Meal Log",
                        "Network error. Your meal will be analysed when you open the app.");
                } catch (Exception e) {
                    savePendingForReanalysis(description, mealType, photoB64 != null);
                    showNotification("Meal Log",
                        "Could not analyse your meal. It will be re-analysed when you open the app.");
                    return; // non-retriable error — don't retry
                }
            }
        }).start();
    }

    /** Save enough info for the WebView to re-analyse the meal on next app open. */
    private void savePendingForReanalysis(String description, String mealType, boolean hasPhoto) {
        try {
            JSONObject pending = new JSONObject();
            pending.put("description", description);
            pending.put("mealType", mealType);
            pending.put("hasPhoto", hasPhoto);
            pending.put("needsReanalysis", true);
            pending.put("timestamp", System.currentTimeMillis());

            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            prefs.edit().putString(KEY_PENDING, pending.toString()).apply();
        } catch (Exception ignored) {}
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
