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
import android.text.InputType;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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
    private static final String TARGET_WEIGH_IN = "weigh-in";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private EditText input;
    private TextView goButton;
    private TextView helperText;
    private LinearLayout card;
    private boolean weighInMode = false;

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

        LinearLayout chips3 = new LinearLayout(this);
        chips3.setOrientation(LinearLayout.HORIZONTAL);
        chips3.setGravity(Gravity.LEFT);
        chips3.addView(chip("Weigh In", TARGET_WEIGH_IN));
        card.addView(chips3, matchWrap());

        helperText = text("Try: open my workout, meal plan, quick log food, weigh yourself", 12, false, "#9CA3AF", Gravity.LEFT);
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
        if (weighInMode) {
            submitWeighInFromInput();
            return;
        }

        String raw = input.getText().toString();
        String target = resolveTarget(raw);
        if (target == null) {
            if (helperText != null) {
                helperText.setText("I can open workouts, meal plans, Quick Log, weigh-ins, character, messages, or form checks.");
                helperText.setTextColor(Color.parseColor("#FBBF24"));
            }
            return;
        }
        if (TARGET_WEIGH_IN.equals(target)) {
            Double parsedWeight = parseWeightKg(raw);
            if (parsedWeight != null) {
                submitWeighIn(parsedWeight);
            } else {
                showWeighInMode();
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
        if (containsAny(q, "weigh", "weight", "scale", "body weight")) return TARGET_WEIGH_IN;
        if (containsAny(q, "calorie tracker", "nutrition", "macros")) return TARGET_CALORIE_TRACKER;
        if (containsAny(q, "movement", "training tab")) return TARGET_MOVEMENT;
        if (containsAny(q, "workout", "training", "session", "gym")) return TARGET_TODAY_WORKOUT;
        if (parseWeightKg(q) != null) return TARGET_WEIGH_IN;
        return null;
    }

    private void openTarget(String target) {
        AndroidLaunchWarmup.release();
        if (TARGET_WEIGH_IN.equals(target)) {
            showWeighInMode();
            return;
        }
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

    private void showWeighInMode() {
        weighInMode = true;
        card.removeAllViews();
        card.setPadding(dp(18), dp(16), dp(18), dp(14));

        TextView title = text("Weigh In", 18, true, "#FFFFFF", Gravity.LEFT);
        TextView subtitle = text("Log today's weight and earn +1 XP", 13, false, "#AEB6C7", Gravity.LEFT);
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
        input.setHint("82.4");
        input.setHintTextColor(Color.parseColor("#94A3B8"));
        input.setTextColor(Color.parseColor("#111827"));
        input.setTextSize(18);
        input.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        input.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        input.setBackgroundColor(Color.TRANSPARENT);
        input.setImeOptions(EditorInfo.IME_ACTION_GO);
        input.setPadding(0, 0, dp(8), 0);
        input.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_GO) {
                submitWeighInFromInput();
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

        TextView unit = text("kg", 15, true, "#64748B", Gravity.CENTER);
        inputRow.addView(unit, new LinearLayout.LayoutParams(dp(34), dp(42)));

        goButton = text("Log", 14, true, "#FFFFFF", Gravity.CENTER);
        goButton.setPadding(dp(13), 0, dp(13), 0);
        goButton.setBackground(roundRect("#7BA883", 16, null, 0));
        goButton.setAlpha(0.45f);
        goButton.setOnClickListener(v -> submitWeighInFromInput());
        inputRow.addView(goButton, new LinearLayout.LayoutParams(dp(62), dp(42)));
        card.addView(inputRow, matchWrap());

        helperText = text("Enter your weight in kg. You will see the XP result here.", 12, false, "#9CA3AF", Gravity.LEFT);
        helperText.setPadding(dp(2), dp(10), dp(2), 0);
        card.addView(helperText, matchWrap());

        mainHandler.postDelayed(() -> {
            input.requestFocus();
            InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            if (imm != null) imm.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT);
        }, 120);
    }

    private void submitWeighInFromInput() {
        Double weightKg = parseWeightKg(input == null ? null : input.getText().toString());
        if (weightKg == null) {
            if (helperText != null) {
                helperText.setText("Enter a valid weight in kg.");
                helperText.setTextColor(Color.parseColor("#FBBF24"));
            }
            return;
        }
        submitWeighIn(weightKg);
    }

    private void submitWeighIn(double weightKg) {
        weighInMode = true;
        if (goButton != null) {
            goButton.setEnabled(false);
            goButton.setAlpha(0.65f);
            goButton.setText("...");
        }
        if (helperText != null) {
            helperText.setText("Logging weigh-in...");
            helperText.setTextColor(Color.parseColor("#AEB6C7"));
        }
        if (input != null) input.setEnabled(false);

        new Thread(() -> {
            try {
                NativeWeighInLogger.Result result = NativeWeighInLogger.log(getApplicationContext(), weightKg);
                runOnUiThread(() -> showWeighInSuccess(result));
            } catch (NativeBalanceSession.AuthRequiredException authRequired) {
                runOnUiThread(() -> showWeighInAuthRequired());
            } catch (Exception e) {
                runOnUiThread(() -> showWeighInError());
            }
        }, "balance-weigh-in").start();
    }

    private void showWeighInSuccess(NativeWeighInLogger.Result result) {
        hideKeyboard();
        card.removeAllViews();
        TextView title = text("Weigh-in logged", 19, true, "#FFFFFF", Gravity.CENTER);
        TextView weight = text(String.format(Locale.US, "%.1f kg", result.weightKg), 30, true, "#DCE7DD", Gravity.CENTER);
        TextView xp = text("+" + result.xpAwarded + " XP earned", 15, true, "#FBBF24", Gravity.CENTER);
        TextView sub = text("Nice. Balance is up to date.", 12, false, "#AEB6C7", Gravity.CENTER);
        title.setPadding(0, 0, 0, dp(10));
        weight.setPadding(0, 0, 0, dp(6));
        xp.setPadding(0, 0, 0, dp(8));
        card.addView(title, matchWrap());
        card.addView(weight, matchWrap());
        card.addView(xp, matchWrap());
        card.addView(sub, matchWrap());
        mainHandler.postDelayed(this::finish, 2200);
    }

    private void showWeighInAuthRequired() {
        if (input != null) input.setEnabled(true);
        if (goButton != null) {
            goButton.setEnabled(true);
            goButton.setText("Log");
            goButton.setAlpha(1f);
        }
        if (helperText != null) {
            helperText.setText("Open Balance once, then this shortcut can log weigh-ins directly.");
            helperText.setTextColor(Color.parseColor("#FBBF24"));
        }
    }

    private void showWeighInError() {
        if (input != null) input.setEnabled(true);
        if (goButton != null) {
            goButton.setEnabled(true);
            goButton.setText("Log");
            goButton.setAlpha(1f);
        }
        if (helperText != null) {
            helperText.setText("Could not log it. Check your connection and try again.");
            helperText.setTextColor(Color.parseColor("#FBBF24"));
        }
    }

    private Double parseWeightKg(String raw) {
        if (raw == null) return null;
        Matcher matcher = Pattern.compile("(\\d+(?:\\.\\d+)?)").matcher(raw);
        if (!matcher.find()) return null;
        try {
            double value = Double.parseDouble(matcher.group(1));
            String lower = raw.toLowerCase(Locale.US);
            double kg = lower.contains("lb") ? value * 0.45359237 : value;
            if (kg < 20 || kg > 500) return null;
            return Math.round(kg * 10.0) / 10.0;
        } catch (Exception e) {
            return null;
        }
    }

    private void hideKeyboard() {
        try {
            InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            View focus = getCurrentFocus();
            if (imm != null && focus != null) imm.hideSoftInputFromWindow(focus.getWindowToken(), 0);
        } catch (Exception ignored) { }
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
