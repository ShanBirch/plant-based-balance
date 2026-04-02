package com.fitgotchi.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
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
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Calendar;

/**
 * Lightweight dialog-themed activity for the "Log Meal" app shortcut.
 * Appears as a floating card over whatever the user was doing — no WebView,
 * no loading screen, no splash.
 *
 * After submit the activity finishes immediately and calls the Netlify
 * analysis API on a background thread. When results arrive, a local
 * notification shows the meal name, macros and calories. The full
 * analysis result is stored in SharedPreferences so that the next time
 * the user opens the app, the WebView persists it to Supabase.
 */
public class QuickMealActivity extends AppCompatActivity {

    private static final String PREFS_NAME = "quick_meal_prefs";
    private static final String KEY_PENDING = "pending_quick_meal";
    private static final String CHANNEL_ID = "meal-reminders";
    private static final String API_BASE = "https://plantbased-balance.org/.netlify/functions";

    private EditText mealInput;
    private TextView submitBtn;
    private ImageView photoPreview;
    private TextView photoLabel;
    private LinearLayout mealTypePills;
    private LinearLayout card;
    private String selectedMealType;
    private Uri cameraOutputUri;
    private String capturedPhotoBase64 = null;

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

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        ensureNotificationChannel();

        int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        if (hour < 11) selectedMealType = "breakfast";
        else if (hour < 15) selectedMealType = "lunch";
        else if (hour < 21) selectedMealType = "dinner";
        else selectedMealType = "snack";

        View rootView = buildUI();
        setContentView(rootView);

        ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, windowInsets) -> {
            Insets imeInsets = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            Insets navInsets = windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars());
            int bottomInset = Math.max(imeInsets.bottom, navInsets.bottom);
            if (card != null) {
                FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) card.getLayoutParams();
                lp.bottomMargin = bottomInset;
                card.setLayoutParams(lp);
            }
            return WindowInsetsCompat.CONSUMED;
        });

        mealInput.requestFocus();
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
        finish();
    }

    // ── Notification channel (required Android 8+) ─────────────────────

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

    // ── UI Construction ────────────────────────────────────────────────

    private View buildUI() {
        float d = getResources().getDisplayMetrics().density;

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#99000000"));
        root.setOnClickListener(v -> finish());

        card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setOnClickListener(v -> {});

        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(Color.parseColor("#1E1E36"));
        cardBg.setCornerRadii(new float[]{24*d,24*d,24*d,24*d,0,0,0,0});
        card.setBackground(cardBg);
        card.setPadding((int)(20*d), (int)(24*d), (int)(20*d), (int)(20*d));

        // Title
        TextView title = new TextView(this);
        title.setText("Quick Log");
        title.setTextColor(Color.WHITE);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        card.addView(title, matchWrap());

        // Subtitle
        TextView subtitle = new TextView(this);
        subtitle.setText("Type what you ate, or snap a photo");
        subtitle.setTextColor(Color.parseColor("#9CA3AF"));
        subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        subtitle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subLp = matchWrap();
        subLp.topMargin = (int)(4*d);
        subLp.bottomMargin = (int)(16*d);
        card.addView(subtitle, subLp);

        // Photo preview (hidden)
        photoPreview = new ImageView(this);
        photoPreview.setScaleType(ImageView.ScaleType.CENTER_CROP);
        photoPreview.setVisibility(View.GONE);
        GradientDrawable prevBg = new GradientDrawable();
        prevBg.setColor(Color.parseColor("#2A2A48"));
        prevBg.setCornerRadius(16*d);
        photoPreview.setBackground(prevBg);
        photoPreview.setClipToOutline(true);
        LinearLayout.LayoutParams prevLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, (int)(160*d));
        prevLp.bottomMargin = (int)(10*d);
        card.addView(photoPreview, prevLp);

        photoLabel = new TextView(this);
        photoLabel.setVisibility(View.GONE);
        photoLabel.setTextColor(Color.parseColor("#7BA883"));
        photoLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        photoLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams plLp = matchWrap();
        plLp.bottomMargin = (int)(8*d);
        card.addView(photoLabel, plLp);

        // Input row
        FrameLayout inputRow = new FrameLayout(this);
        GradientDrawable inputBg = new GradientDrawable();
        inputBg.setColor(Color.parseColor("#2A2A48"));
        inputBg.setCornerRadius(16*d);
        inputBg.setStroke((int)(1*d), Color.parseColor("#3A3A58"));
        inputRow.setBackground(inputBg);

        mealInput = new EditText(this);
        mealInput.setHint("e.g. porridge with banana and peanut butter");
        mealInput.setHintTextColor(Color.parseColor("#666680"));
        mealInput.setTextColor(Color.WHITE);
        mealInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        mealInput.setBackground(null);
        mealInput.setPadding((int)(16*d),(int)(14*d),(int)(52*d),(int)(14*d));
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
        FrameLayout.LayoutParams camLp = new FrameLayout.LayoutParams((int)(44*d),(int)(44*d));
        camLp.gravity = Gravity.END | Gravity.CENTER_VERTICAL;
        camLp.rightMargin = (int)(6*d);
        camBtn.setOnClickListener(v -> onCameraTapped());
        inputRow.addView(camBtn, camLp);

        LinearLayout.LayoutParams irLp = matchWrap();
        irLp.bottomMargin = (int)(12*d);
        card.addView(inputRow, irLp);

        // Meal type pills
        mealTypePills = new LinearLayout(this);
        mealTypePills.setOrientation(LinearLayout.HORIZONTAL);
        String[] types = {"breakfast","lunch","dinner","snack"};
        String[] labels = {"Breakfast","Lunch","Dinner","Snack"};
        for (int i = 0; i < types.length; i++) {
            final String type = types[i];
            TextView pill = new TextView(this);
            pill.setText(labels[i]);
            pill.setTag(type);
            pill.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
            pill.setTypeface(Typeface.DEFAULT_BOLD);
            pill.setGravity(Gravity.CENTER);
            pill.setPadding((int)(6*d),(int)(10*d),(int)(6*d),(int)(10*d));
            pill.setOnClickListener(v -> selectMealType(type));
            LinearLayout.LayoutParams plp = new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
            plp.leftMargin = (int)(4*d); plp.rightMargin = (int)(4*d);
            mealTypePills.addView(pill, plp);
        }
        LinearLayout.LayoutParams pillsLp = matchWrap();
        pillsLp.bottomMargin = (int)(14*d);
        card.addView(mealTypePills, pillsLp);
        refreshPills();

        // Submit
        submitBtn = new TextView(this);
        submitBtn.setText("Log Meal");
        submitBtn.setTextColor(Color.WHITE);
        submitBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        submitBtn.setTypeface(Typeface.DEFAULT_BOLD);
        submitBtn.setGravity(Gravity.CENTER);
        submitBtn.setPadding(0,(int)(15*d),0,(int)(15*d));
        submitBtn.setOnClickListener(v -> submitMeal());
        card.addView(submitBtn, matchWrap());
        updateSubmitState();

        // Cancel
        TextView cancel = new TextView(this);
        cancel.setText("Cancel");
        cancel.setTextColor(Color.parseColor("#9CA3AF"));
        cancel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        cancel.setGravity(Gravity.CENTER);
        cancel.setPadding(0,(int)(12*d),0,(int)(8*d));
        cancel.setOnClickListener(v -> finish());
        card.addView(cancel, matchWrap());

        FrameLayout.LayoutParams cardLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        cardLp.gravity = Gravity.BOTTOM;
        root.addView(card, cardLp);
        return root;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    // ── Meal type ──────────────────────────────────────────────────────

    private void selectMealType(String type) {
        selectedMealType = type;
        refreshPills();
    }

    private void refreshPills() {
        float d = getResources().getDisplayMetrics().density;
        for (int i = 0; i < mealTypePills.getChildCount(); i++) {
            TextView pill = (TextView) mealTypePills.getChildAt(i);
            boolean active = selectedMealType.equals(pill.getTag());
            GradientDrawable bg = new GradientDrawable();
            bg.setCornerRadius(12*d);
            if (active) {
                bg.setColor(Color.parseColor("#2D5A3E"));
                bg.setStroke((int)(1*d), Color.parseColor("#7BA883"));
                pill.setTextColor(Color.WHITE);
            } else {
                bg.setColor(Color.TRANSPARENT);
                bg.setStroke((int)(1*d), Color.parseColor("#3A3A58"));
                pill.setTextColor(Color.parseColor("#9CA3AF"));
            }
            pill.setBackground(bg);
        }
    }

    // ── Submit state ───────────────────────────────────────────────────

    private boolean canSubmit() {
        return mealInput.getText().toString().trim().length() >= 3
            || capturedPhotoBase64 != null;
    }

    private void updateSubmitState() {
        float d = getResources().getDisplayMetrics().density;
        boolean ok = canSubmit();
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(16*d);
        bg.setColor(Color.parseColor(ok ? "#7BA883" : "#3A3A58"));
        submitBtn.setBackground(bg);
        submitBtn.setAlpha(ok ? 1f : 0.5f);
        submitBtn.setEnabled(ok);
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
            File f = new File(getCacheDir(), "quick_meal_photo.jpg");
            cameraOutputUri = FileProvider.getUriForFile(this, getPackageName()+".fileprovider", f);
            cameraLauncher.launch(cameraOutputUri);
        } catch (Exception ignored) {}
    }

    private void processPhoto(Uri uri) {
        new Thread(() -> {
            try {
                InputStream is = getContentResolver().openInputStream(uri);
                Bitmap bmp = BitmapFactory.decodeStream(is);
                if (is != null) is.close();
                if (bmp == null) return;
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
                final Bitmap preview = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                bmp.recycle();
                runOnUiThread(() -> {
                    if (preview != null) {
                        photoPreview.setImageBitmap(preview);
                        photoPreview.setVisibility(View.VISIBLE);
                        photoLabel.setText("Photo attached — add a description for better accuracy");
                        photoLabel.setVisibility(View.VISIBLE);
                    }
                    updateSubmitState();
                });
            } catch (Exception e) { capturedPhotoBase64 = null; }
        }).start();
    }

    // ── Submit ─────────────────────────────────────────────────────────

    private void submitMeal() {
        if (!canSubmit()) return;

        final String description = mealInput.getText().toString().trim();
        final String mealType = selectedMealType;
        final String photoB64 = capturedPhotoBase64;

        // Close the overlay instantly — everything else happens in background
        finish();

        // Fire off API call + notification on a background thread
        new Thread(() -> {
            try {
                String responseBody;
                if (photoB64 != null) {
                    responseBody = callAnalyzeFood(photoB64, description);
                } else {
                    responseBody = callAnalyzeMealText(description, mealType);
                }

                JSONObject resp = new JSONObject(responseBody);
                if (!resp.optBoolean("success", false)) {
                    showSimpleNotification("Meal Log Failed",
                        "Could not analyse your meal. Open the app to try again.");
                    return;
                }

                JSONObject data = resp.getJSONObject("data");
                JSONObject totals = data.optJSONObject("totals");
                String notes = data.optString("notes", "");

                // Build meal name from notes or food items
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

                String title = "Meal Logged — " + cal + " cal";
                String body = mealName + "\n"
                    + "P " + protein + "g  •  C " + carbs + "g  •  F " + fat + "g";

                showSimpleNotification(title, body);

                // Save the full result + meal metadata for the WebView to persist
                JSONObject pending = new JSONObject();
                pending.put("description", description);
                pending.put("mealType", mealType);
                pending.put("hasPhoto", photoB64 != null);
                pending.put("analysisResult", data.toString());
                pending.put("timestamp", System.currentTimeMillis());
                // Don't store the full base64 photo in prefs — too large.
                // The WebView will save it as a text-input meal if no photo URL.

                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                prefs.edit().putString(KEY_PENDING, pending.toString()).apply();

            } catch (Exception e) {
                showSimpleNotification("Meal Log",
                    "Analysing your meal took too long. Open the app to try again.");
            }
        }).start();
    }

    // ── Netlify API calls ──────────────────────────────────────────────

    private String callAnalyzeMealText(String description, String mealType) throws Exception {
        JSONObject body = new JSONObject();
        body.put("description", description);
        body.put("mealType", mealType);
        return httpPost(API_BASE + "/analyze-meal-text", body.toString());
    }

    private String callAnalyzeFood(String base64, String description) throws Exception {
        JSONObject body = new JSONObject();
        body.put("imageBase64", base64);
        body.put("mimeType", "image/jpeg");
        body.put("description", description);
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
        BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) sb.append(line);
        reader.close();
        conn.disconnect();
        return sb.toString();
    }

    // ── Notification ───────────────────────────────────────────────────

    private void showSimpleNotification(String title, String body) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)  // fallback icon
            .setContentTitle(title)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true);

        // Try to use the app's notification icon if available
        int iconRes = getResources().getIdentifier("ic_stat_notification", "drawable", getPackageName());
        if (iconRes != 0) b.setSmallIcon(iconRes);

        nm.notify(9000 + (int)(System.currentTimeMillis() % 1000), b.build());
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\","\\\\").replace("\"","\\\"")
                .replace("\n","\\n").replace("\r","\\r").replace("\t","\\t");
    }
}
