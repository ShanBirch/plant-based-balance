package com.fitgotchi.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import java.util.Locale;

/**
 * Native command popup launched from the Ask Balance home-screen widget.
 * It stays intentionally small: parse common commands, then either open
 * Quick Log directly or pass a route target to the web app.
 */
public class AskBalanceActivity extends Activity {

    static final String ACTION_ASK_BALANCE = "com.fitgotchi.app.ACTION_ASK_BALANCE";
    static final String ACTION_ROUTE = "com.fitgotchi.app.ACTION_ASK_BALANCE_ROUTE";
    static final String EXTRA_TARGET = "balance_target";

    private static final String TARGET_TODAY_WORKOUT = "today-workout";
    private static final String TARGET_MEAL_PLAN = "meal-plan";
    private static final String TARGET_FITGOTCHI = "fitgotchi";
    private static final String TARGET_COACH = "coach";
    private static final String TARGET_FORM_CHECK = "form-check";
    private static final String TARGET_WORKOUT_LIBRARY = "workout-library";
    private static final String TARGET_WORKOUT_BUILDER = "workout-builder";
    private static final String TARGET_MEAL_BUILDER = "meal-builder";
    private static final String TARGET_CALORIE_TRACKER = "calorie-tracker";
    private static final String TARGET_MOVEMENT = "movement";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private EditText input;
    private TextView goButton;
    private TextView helperText;
    private LinearLayout card;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
                | WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#99000000"));
        root.setOnClickListener(v -> finish());
        setContentView(root);

        card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(16), dp(18), dp(14));
        card.setBackground(roundRect("#1A1A2E", 24, "#2F3855", 1));
        card.setOnClickListener(v -> { });

        TextView title = text("Ask Balance", 18, true, "#FFFFFF", Gravity.LEFT);
        TextView subtitle = text("Type what you want to open", 13, false, "#AEB6C7", Gravity.LEFT);
        subtitle.setPadding(0, dp(3), 0, dp(12));
        card.addView(title, matchWrap());
        card.addView(subtitle, matchWrap());

        LinearLayout inputRow = new LinearLayout(this);
        inputRow.setOrientation(LinearLayout.HORIZONTAL);
        inputRow.setGravity(Gravity.CENTER_VERTICAL);
        inputRow.setPadding(dp(12), dp(8), dp(8), dp(8));
        inputRow.setBackground(roundRect("#FFFFFF", 18, "#E5E7EB", 1));

        input = new EditText(this);
        input.setSingleLine(true);
        input.setHint("workout, meal plan, quick log...");
        input.setHintTextColor(Color.parseColor("#94A3B8"));
        input.setTextColor(Color.parseColor("#111827"));
        input.setTextSize(16);
        input.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));
        input.setBackgroundColor(Color.TRANSPARENT);
        input.setImeOptions(EditorInfo.IME_ACTION_GO);
        input.setPadding(0, 0, dp(8), 0);
        input.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_GO) {
                submitCommand();
                return true;
            }
            return false;
        });
        input.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) { }
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                updateGoState();
            }
            @Override public void afterTextChanged(Editable s) { }
        });
        inputRow.addView(input, new LinearLayout.LayoutParams(0, dp(44), 1));

        goButton = text("Go", 14, true, "#FFFFFF", Gravity.CENTER);
        goButton.setPadding(dp(16), 0, dp(16), 0);
        goButton.setBackground(roundRect("#7BA883", 16, null, 0));
        goButton.setAlpha(0.45f);
        goButton.setOnClickListener(v -> submitCommand());
        inputRow.addView(goButton, new LinearLayout.LayoutParams(dp(58), dp(42)));
        card.addView(inputRow, matchWrap());

        LinearLayout chips = new LinearLayout(this);
        chips.setOrientation(LinearLayout.HORIZONTAL);
        chips.setGravity(Gravity.LEFT);
        chips.setPadding(0, dp(12), 0, dp(4));
        chips.addView(chip("Workout", TARGET_TODAY_WORKOUT));
        chips.addView(chip("Meal Plan", TARGET_MEAL_PLAN));
        chips.addView(chip("Quick Log", "quick-log"));
        card.addView(chips, matchWrap());

        LinearLayout chips2 = new LinearLayout(this);
        chips2.setOrientation(LinearLayout.HORIZONTAL);
        chips2.setGravity(Gravity.LEFT);
        chips2.addView(chip("Character", TARGET_FITGOTCHI));
        chips2.addView(chip("Message Shannon", TARGET_COACH));
        chips2.addView(chip("Form Check", TARGET_FORM_CHECK));
        card.addView(chips2, matchWrap());

        helperText = text("Try: open my workout, meal plan, quick log food", 12, false, "#9CA3AF", Gravity.LEFT);
        helperText.setPadding(dp(2), dp(10), dp(2), 0);
        card.addView(helperText, matchWrap());

        ScrollView scroll = new ScrollView(this);
        scroll.addView(card);
        FrameLayout.LayoutParams scrollLp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM);
        scrollLp.leftMargin = dp(14);
        scrollLp.rightMargin = dp(14);
        scrollLp.bottomMargin = dp(12);
        root.addView(scroll, scrollLp);
        root.postDelayed(() -> AndroidLaunchWarmup.prewarm(getApplicationContext()), 80);

        ViewCompat.setOnApplyWindowInsetsListener(root, (v, wi) -> {
            Insets ime = wi.getInsets(WindowInsetsCompat.Type.ime());
            Insets nav = wi.getInsets(WindowInsetsCompat.Type.navigationBars());
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) scroll.getLayoutParams();
            lp.bottomMargin = Math.max(dp(12), Math.max(ime.bottom, nav.bottom) + dp(8));
            scroll.setLayoutParams(lp);
            return WindowInsetsCompat.CONSUMED;
        });

        mainHandler.postDelayed(() -> {
            input.requestFocus();
            InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            if (imm != null) imm.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT);
        }, 200);
    }

    private void updateGoState() {
        boolean hasText = input != null && input.getText() != null
                && input.getText().toString().trim().length() > 0;
        if (goButton != null) goButton.setAlpha(hasText ? 1f : 0.45f);
    }

    private void submitCommand() {
        if (input == null) return;
        String target = resolveTarget(input.getText().toString());
        if (target == null) {
            if (helperText != null) {
                helperText.setText("I can open workouts, meal plans, Quick Log, character, messages, or form checks.");
                helperText.setTextColor(Color.parseColor("#FBBF24"));
            }
            return;
        }
        openTarget(target);
    }

    private String resolveTarget(String raw) {
        String q = normalize(raw);
        if (q.length() == 0) return null;

        if (containsAny(q, "meal plan", "food plan", "plan meals", "menu")) return TARGET_MEAL_PLAN;
        if (containsAny(q, "quick log", "log meal", "log food", "track food", "track meal", "calorie log", "food log")) return "quick-log";
        if (containsAny(q, "workout library", "browse workouts", "program library")) return TARGET_WORKOUT_LIBRARY;
        if (containsAny(q, "build workout", "workout builder", "custom workout")) return TARGET_WORKOUT_BUILDER;
        if (containsAny(q, "form check", "check form", "technique")) return TARGET_FORM_CHECK;
        if (containsAny(q, "meal builder", "build meal", "saved meal")) return TARGET_MEAL_BUILDER;
        if (containsAny(q, "character", "fitgotchi", "pet", "avatar", "mascot")) return TARGET_FITGOTCHI;
        if (containsAny(q, "message shannon", "coach", "dm", "message coach", "chat")) return TARGET_COACH;
        if (containsAny(q, "calorie tracker", "nutrition", "macros")) return TARGET_CALORIE_TRACKER;
        if (containsAny(q, "movement", "training tab")) return TARGET_MOVEMENT;
        if (containsAny(q, "workout", "training", "session", "gym")) return TARGET_TODAY_WORKOUT;
        return null;
    }

    private void openTarget(String target) {
        AndroidLaunchWarmup.release();
        if ("quick-log".equals(target)) {
            Intent quick = new Intent(this, QuickMealActivity.class);
            quick.setAction("com.fitgotchi.app.ACTION_QUICK_MEAL");
            startActivity(quick);
            finish();
            return;
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(ACTION_ROUTE);
        intent.putExtra(EXTRA_TARGET, target);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(intent);
        finish();
    }

    private String normalize(String raw) {
        if (raw == null) return "";
        return raw.toLowerCase(Locale.US)
                .replaceAll("[^a-z0-9 ]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private boolean containsAny(String text, String... needles) {
        for (String needle : needles) {
            if (text.contains(needle)) return true;
        }
        return false;
    }

    private TextView chip(String label, String target) {
        TextView tv = text(label, 12, true, "#DCE7DD", Gravity.CENTER);
        tv.setPadding(dp(11), dp(8), dp(11), dp(8));
        tv.setBackground(roundRect("#243047", 18, "#3C4A64", 1));
        tv.setOnClickListener(v -> openTarget(target));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.rightMargin = dp(8);
        lp.bottomMargin = dp(8);
        tv.setLayoutParams(lp);
        return tv;
    }

    private TextView text(String value, float sp, boolean bold, String color, int gravity) {
        TextView tv = new TextView(this);
        tv.setText(value);
        tv.setTextSize(sp);
        tv.setTextColor(Color.parseColor(color));
        tv.setGravity(gravity);
        tv.setTypeface(Typeface.create("sans-serif", bold ? Typeface.BOLD : Typeface.NORMAL));
        return tv;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private GradientDrawable roundRect(String color, int radiusDp, String strokeColor, int strokeWidthDp) {
        GradientDrawable gd = new GradientDrawable();
        gd.setShape(GradientDrawable.RECTANGLE);
        gd.setColor(Color.parseColor(color));
        gd.setCornerRadius(dp(radiusDp));
        if (strokeColor != null && strokeWidthDp > 0) {
            gd.setStroke(dp(strokeWidthDp), Color.parseColor(strokeColor));
        }
        return gd;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
