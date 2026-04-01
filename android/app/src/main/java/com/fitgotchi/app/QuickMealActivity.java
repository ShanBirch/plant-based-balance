package com.fitgotchi.app;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Base64;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.util.Calendar;

/**
 * Lightweight dialog-themed activity for the "Log Meal" app shortcut.
 * Appears as a floating card over whatever the user was doing — no WebView,
 * no loading screen, no splash. The user types what they ate (and/or takes
 * a photo), taps submit, and the activity finishes. The meal data is stored
 * in SharedPreferences and picked up by the WebView in MainActivity for
 * background analysis and saving.
 */
public class QuickMealActivity extends AppCompatActivity {

    private static final String PREFS_NAME = "quick_meal_prefs";
    private static final String KEY_PENDING = "pending_quick_meal";

    private EditText mealInput;
    private TextView submitBtn;
    private ImageView photoPreview;
    private TextView photoLabel;
    private LinearLayout mealTypePills;
    private LinearLayout card;
    private String selectedMealType;
    private Uri cameraOutputUri;
    private String capturedPhotoBase64 = null;

    // Camera permission + capture launchers
    private final ActivityResultLauncher<String> cameraPermLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
            if (granted) launchCamera();
        });

    private final ActivityResultLauncher<Uri> cameraLauncher =
        registerForActivityResult(new ActivityResultContracts.TakePicture(), success -> {
            if (success && cameraOutputUri != null) {
                processPhoto(cameraOutputUri);
            }
        });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        supportRequestWindowFeature(Window.FEATURE_NO_TITLE);
        super.onCreate(savedInstanceState);

        // Let us handle insets manually so the card moves above the keyboard
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Auto-detect meal type from time of day
        int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        if (hour < 11) selectedMealType = "breakfast";
        else if (hour < 15) selectedMealType = "lunch";
        else if (hour < 21) selectedMealType = "dinner";
        else selectedMealType = "snack";

        View rootView = buildUI();
        setContentView(rootView);

        // Listen for keyboard (IME) insets and push the card up above the keyboard
        ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, windowInsets) -> {
            Insets imeInsets = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            Insets navInsets = windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars());
            // Use whichever is taller — keyboard or nav bar
            int bottomInset = Math.max(imeInsets.bottom, navInsets.bottom);
            if (card != null) {
                FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) card.getLayoutParams();
                lp.bottomMargin = bottomInset;
                card.setLayoutParams(lp);
            }
            return WindowInsetsCompat.CONSUMED;
        });

        // Focus the text input
        mealInput.requestFocus();
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
        finish();
    }

    // ── UI Construction ────────────────────────────────────────────────

    private View buildUI() {
        float density = getResources().getDisplayMetrics().density;

        // Root: semi-transparent background, tappable to dismiss
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#99000000"));
        root.setOnClickListener(v -> finish());

        // Card container (bottom-aligned, moves up with keyboard via insets)
        card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setOnClickListener(v -> {}); // consume clicks so tapping card doesn't dismiss

        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(Color.parseColor("#1E1E36"));
        cardBg.setCornerRadii(new float[]{
            24 * density, 24 * density, 24 * density, 24 * density, 0, 0, 0, 0});
        card.setBackground(cardBg);
        int hPad = (int)(20 * density);
        int vPad = (int)(24 * density);
        card.setPadding(hPad, vPad, hPad, (int)(20 * density));

        // Title
        TextView title = new TextView(this);
        title.setText("Quick Log");
        title.setTextColor(Color.WHITE);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        card.addView(title, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        // Subtitle
        TextView subtitle = new TextView(this);
        subtitle.setText("Type what you ate, or snap a photo");
        subtitle.setTextColor(Color.parseColor("#9CA3AF"));
        subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        subtitle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        subLp.topMargin = (int)(4 * density);
        subLp.bottomMargin = (int)(16 * density);
        card.addView(subtitle, subLp);

        // Photo preview (hidden by default)
        photoPreview = new ImageView(this);
        photoPreview.setScaleType(ImageView.ScaleType.CENTER_CROP);
        photoPreview.setVisibility(View.GONE);
        GradientDrawable previewBg = new GradientDrawable();
        previewBg.setColor(Color.parseColor("#2A2A48"));
        previewBg.setCornerRadius(16 * density);
        photoPreview.setBackground(previewBg);
        photoPreview.setClipToOutline(true);
        LinearLayout.LayoutParams previewLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, (int)(160 * density));
        previewLp.bottomMargin = (int)(10 * density);
        card.addView(photoPreview, previewLp);

        // Photo label
        photoLabel = new TextView(this);
        photoLabel.setVisibility(View.GONE);
        photoLabel.setTextColor(Color.parseColor("#7BA883"));
        photoLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        photoLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams photoLabelLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        photoLabelLp.bottomMargin = (int)(8 * density);
        card.addView(photoLabel, photoLabelLp);

        // Input row: EditText + camera button
        FrameLayout inputRow = new FrameLayout(this);
        GradientDrawable inputBg = new GradientDrawable();
        inputBg.setColor(Color.parseColor("#2A2A48"));
        inputBg.setCornerRadius(16 * density);
        inputBg.setStroke((int)(1 * density), Color.parseColor("#3A3A58"));
        inputRow.setBackground(inputBg);

        mealInput = new EditText(this);
        mealInput.setHint("e.g. porridge with banana and peanut butter");
        mealInput.setHintTextColor(Color.parseColor("#666680"));
        mealInput.setTextColor(Color.WHITE);
        mealInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        mealInput.setBackground(null);
        mealInput.setPadding((int)(16 * density), (int)(14 * density),
            (int)(52 * density), (int)(14 * density));
        mealInput.setMaxLines(3);
        mealInput.setImeOptions(EditorInfo.IME_ACTION_DONE);
        mealInput.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void afterTextChanged(Editable s) { updateSubmitState(); }
        });
        // Allow submit via keyboard "done" action
        mealInput.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE && canSubmit()) {
                submitMeal();
                return true;
            }
            return false;
        });
        inputRow.addView(mealInput, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT));

        // Camera icon button
        ImageButton cameraBtn = new ImageButton(this);
        cameraBtn.setImageResource(android.R.drawable.ic_menu_camera);
        cameraBtn.setColorFilter(Color.parseColor("#7BA883"));
        cameraBtn.setBackground(null);
        int camSize = (int)(44 * density);
        FrameLayout.LayoutParams camLp = new FrameLayout.LayoutParams(camSize, camSize);
        camLp.gravity = Gravity.END | Gravity.CENTER_VERTICAL;
        camLp.rightMargin = (int)(6 * density);
        cameraBtn.setOnClickListener(v -> onCameraTapped());
        inputRow.addView(cameraBtn, camLp);

        LinearLayout.LayoutParams inputRowLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        inputRowLp.bottomMargin = (int)(12 * density);
        card.addView(inputRow, inputRowLp);

        // Meal type pills row
        mealTypePills = new LinearLayout(this);
        mealTypePills.setOrientation(LinearLayout.HORIZONTAL);
        mealTypePills.setGravity(Gravity.CENTER);
        String[] types = {"breakfast", "lunch", "dinner", "snack"};
        String[] labels = {"Breakfast", "Lunch", "Dinner", "Snack"};
        for (int i = 0; i < types.length; i++) {
            final String type = types[i];
            TextView pill = new TextView(this);
            pill.setText(labels[i]);
            pill.setTag(type);
            pill.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
            pill.setTypeface(Typeface.DEFAULT_BOLD);
            pill.setGravity(Gravity.CENTER);
            pill.setPadding((int)(6 * density), (int)(10 * density),
                (int)(6 * density), (int)(10 * density));
            pill.setOnClickListener(v -> selectMealType(type));
            LinearLayout.LayoutParams pillLp = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
            pillLp.leftMargin = (int)(4 * density);
            pillLp.rightMargin = (int)(4 * density);
            mealTypePills.addView(pill, pillLp);
        }
        LinearLayout.LayoutParams pillsLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        pillsLp.bottomMargin = (int)(14 * density);
        card.addView(mealTypePills, pillsLp);
        refreshPills();

        // Submit button
        submitBtn = new TextView(this);
        submitBtn.setText("Log Meal");
        submitBtn.setTextColor(Color.WHITE);
        submitBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        submitBtn.setTypeface(Typeface.DEFAULT_BOLD);
        submitBtn.setGravity(Gravity.CENTER);
        submitBtn.setPadding(0, (int)(15 * density), 0, (int)(15 * density));
        submitBtn.setOnClickListener(v -> submitMeal());
        card.addView(submitBtn, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        updateSubmitState();

        // Cancel text
        TextView cancel = new TextView(this);
        cancel.setText("Cancel");
        cancel.setTextColor(Color.parseColor("#9CA3AF"));
        cancel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        cancel.setGravity(Gravity.CENTER);
        cancel.setPadding(0, (int)(12 * density), 0, (int)(8 * density));
        cancel.setOnClickListener(v -> finish());
        card.addView(cancel, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        // Position card at bottom — margin is updated dynamically by the inset listener
        FrameLayout.LayoutParams cardLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        cardLp.gravity = Gravity.BOTTOM;
        root.addView(card, cardLp);

        return root;
    }

    // ── Meal type selection ────────────────────────────────────────────

    private void selectMealType(String type) {
        selectedMealType = type;
        refreshPills();
    }

    private void refreshPills() {
        float density = getResources().getDisplayMetrics().density;
        for (int i = 0; i < mealTypePills.getChildCount(); i++) {
            TextView pill = (TextView) mealTypePills.getChildAt(i);
            boolean active = selectedMealType.equals(pill.getTag());
            GradientDrawable bg = new GradientDrawable();
            bg.setCornerRadius(12 * density);
            if (active) {
                bg.setColor(Color.parseColor("#2D5A3E"));
                bg.setStroke((int)(1 * density), Color.parseColor("#7BA883"));
                pill.setTextColor(Color.WHITE);
            } else {
                bg.setColor(Color.TRANSPARENT);
                bg.setStroke((int)(1 * density), Color.parseColor("#3A3A58"));
                pill.setTextColor(Color.parseColor("#9CA3AF"));
            }
            pill.setBackground(bg);
        }
    }

    // ── Submit state ───────────────────────────────────────────────────

    private boolean canSubmit() {
        String text = mealInput.getText().toString().trim();
        return text.length() >= 3 || capturedPhotoBase64 != null;
    }

    private void updateSubmitState() {
        float density = getResources().getDisplayMetrics().density;
        boolean enabled = canSubmit();
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(16 * density);
        if (enabled) {
            bg.setColor(Color.parseColor("#7BA883"));
            submitBtn.setAlpha(1f);
        } else {
            bg.setColor(Color.parseColor("#3A3A58"));
            submitBtn.setAlpha(0.5f);
        }
        submitBtn.setBackground(bg);
        submitBtn.setEnabled(enabled);
    }

    // ── Camera ─────────────────────────────────────────────────────────

    private void onCameraTapped() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) {
            launchCamera();
        } else {
            cameraPermLauncher.launch(Manifest.permission.CAMERA);
        }
    }

    private void launchCamera() {
        try {
            File tempFile = new File(getCacheDir(), "quick_meal_photo.jpg");
            cameraOutputUri = FileProvider.getUriForFile(
                this, getPackageName() + ".fileprovider", tempFile);
            cameraLauncher.launch(cameraOutputUri);
        } catch (Exception e) {
            // Camera not available
        }
    }

    private void processPhoto(Uri photoUri) {
        new Thread(() -> {
            try {
                InputStream is = getContentResolver().openInputStream(photoUri);
                Bitmap bitmap = BitmapFactory.decodeStream(is);
                if (is != null) is.close();
                if (bitmap == null) return;

                // Downscale to max 1024px
                int maxW = 1024;
                if (bitmap.getWidth() > maxW) {
                    int h = (int)(bitmap.getHeight() * (float)maxW / bitmap.getWidth());
                    Bitmap scaled = Bitmap.createScaledBitmap(bitmap, maxW, h, true);
                    bitmap.recycle();
                    bitmap = scaled;
                }

                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.JPEG, 80, baos);
                byte[] bytes = baos.toByteArray();
                capturedPhotoBase64 = Base64.encodeToString(bytes, Base64.NO_WRAP);

                // Show preview on UI thread
                final Bitmap previewBitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                bitmap.recycle();

                runOnUiThread(() -> {
                    if (previewBitmap != null) {
                        photoPreview.setImageBitmap(previewBitmap);
                        photoPreview.setVisibility(View.VISIBLE);
                        photoLabel.setText("Photo attached — add a description for better accuracy");
                        photoLabel.setVisibility(View.VISIBLE);
                    }
                    updateSubmitState();
                });
            } catch (Exception e) {
                capturedPhotoBase64 = null;
            }
        }).start();
    }

    // ── Submit ─────────────────────────────────────────────────────────

    private void submitMeal() {
        if (!canSubmit()) return;

        String description = mealInput.getText().toString().trim();

        // Build a JSON payload for the WebView to pick up
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"description\":\"").append(escapeJson(description)).append("\",");
        json.append("\"mealType\":\"").append(selectedMealType).append("\",");
        json.append("\"hasPhoto\":").append(capturedPhotoBase64 != null).append(",");
        if (capturedPhotoBase64 != null) {
            json.append("\"photoBase64\":\"").append(capturedPhotoBase64).append("\",");
        }
        json.append("\"timestamp\":").append(System.currentTimeMillis());
        json.append("}");

        // Save to SharedPreferences for the WebView to pick up
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        prefs.edit().putString(KEY_PENDING, json.toString()).apply();

        // Start MainActivity (which loads the WebView) — it will detect the pending data
        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.setAction("com.fitgotchi.app.ACTION_QUICK_MEAL");
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(mainIntent);

        finish();
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
