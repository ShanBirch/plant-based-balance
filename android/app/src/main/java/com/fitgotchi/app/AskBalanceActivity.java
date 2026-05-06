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

import java.util.Calendar;
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
    private static final String TARGET_MANUAL_MACROS = "manual-log";
    private static final String TARGET_QUICK_LOG_PHOTO = "quick-log-photo";
    private static final String TARGET_DAILY_QUIZ = "daily-quiz";
    private static final String TARGET_FEED = "feed";
    private static final String TARGET_FEED_PHOTO = "feed-photo";

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
        TextView subtitle = text("Macros, weigh-ins, food, workouts, quiz - just type.", 13, false, "#AEB6C7", Gravity.LEFT);
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
        input.setHint("add 500 cal 35p 60c 12f");
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

        helperText = text("Try: add 500 cal 35p 60c 12f, weigh in 82.4, open quiz", 12, false, "#9CA3AF", Gravity.LEFT);
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
        MacroEntry macroEntry = parseMacroEntry(raw);
        if (macroEntry != null) {
            submitMacroEntry(macroEntry);
            return;
        }

        String target = resolveTarget(raw);
        if (target == null) {
            if (helperText != null) {
                helperText.setText("I can log macros, ask what you ate, weigh in, or open workouts, quiz, Feed, messages, and form checks.");
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

        if (containsAny(q, "post photo", "post a photo", "post this photo", "share photo", "share a photo", "post to feed", "post on feed", "photo on feed")) return TARGET_FEED_PHOTO;
        if (containsAny(q, "meal camera", "food camera", "open camera", "camera", "snap meal", "meal photo", "food photo", "photo food", "take food photo", "barcode", "scan barcode", "scanner")) return TARGET_QUICK_LOG_PHOTO;
        if (containsAny(q, "open feed", "go to feed", "feed tab", "friends feed")) return TARGET_FEED;
        if (containsAny(q, "daily quiz", "open quiz", "start quiz", "take quiz", "quiz", "health iq")) return TARGET_DAILY_QUIZ;
        if (containsAny(q, "meal plan", "food plan", "plan meals", "menu")) return TARGET_MEAL_PLAN;
        if (containsAny(q, "quick log", "log meal", "log food", "track food", "track meal", "track calories", "track these calories", "calorie log", "food log")) return "quick-log";
        if (containsAny(q, "workout library", "browse workouts", "program library")) return TARGET_WORKOUT_LIBRARY;
        if (containsAny(q, "build workout", "workout builder", "custom workout")) return TARGET_WORKOUT_BUILDER;
        if (containsAny(q, "form check", "check form", "technique")) return TARGET_FORM_CHECK;
        if (containsAny(q, "meal builder", "build meal", "saved meal")) return TARGET_MEAL_BUILDER;
        if (containsAny(q, "character", "fitgotchi", "pet", "avatar", "mascot")) return TARGET_FITGOTCHI;
        if (containsAny(q, "message shannon", "coach", "dm", "message coach", "chat")) return TARGET_COACH;
        if (containsAny(q, "weigh", "weight", "scale", "body weight")) return TARGET_WEIGH_IN;
        if (containsAny(q, "manual macros", "manual calories", "enter macros", "known macros", "add macros", "log macros")) return TARGET_MANUAL_MACROS;
        if (containsAny(q, "calorie tracker", "nutrition tracker", "open nutrition", "view nutrition")) return TARGET_CALORIE_TRACKER;
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
        if (TARGET_QUICK_LOG_PHOTO.equals(target)) {
            Intent camera = new Intent(this, QuickMealActivity.class);
            camera.setAction("com.fitgotchi.app.ACTION_QUICK_MEAL.camera.ask");
            camera.putExtra("mode", "camera");
            startActivity(camera);
            finish();
            return;
        }
        if (TARGET_MANUAL_MACROS.equals(target)) {
            Intent manual = new Intent(this, QuickMealActivity.class);
            manual.setAction("com.fitgotchi.app.ACTION_QUICK_MEAL");
            manual.putExtra("mode", "manual");
            startActivity(manual);
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

    private void submitMacroEntry(MacroEntry entry) {
        hideKeyboard();
        if (goButton != null) {
            goButton.setEnabled(false);
            goButton.setAlpha(0.65f);
            goButton.setText("...");
        }
        if (helperText != null) {
            helperText.setText("Logging macros...");
            helperText.setTextColor(Color.parseColor("#AEB6C7"));
        }
        if (input != null) input.setEnabled(false);

        new Thread(() -> {
            try {
                NativeMacroLogger.logManual(
                        getApplicationContext(),
                        entry.name,
                        entry.calories,
                        entry.protein,
                        entry.carbs,
                        entry.fat,
                        autoMealType());
                runOnUiThread(() -> showMacroSuccess(entry));
            } catch (Exception e) {
                runOnUiThread(() -> showMacroError());
            }
        }, "balance-macro-log").start();
    }

    private void showMacroSuccess(MacroEntry entry) {
        card.removeAllViews();
        TextView title = text("Macros logged", 19, true, "#FFFFFF", Gravity.CENTER);
        TextView calories = text(entry.calories + " cal", 30, true, "#DCE7DD", Gravity.CENTER);
        TextView macros = text(
                String.format(Locale.US, "P %.1fg | C %.1fg | F %.1fg", entry.protein, entry.carbs, entry.fat),
                15,
                true,
                "#FBBF24",
                Gravity.CENTER);
        TextView sub = text("Saved from the widget. Balance will sync the full log next open.", 12, false, "#AEB6C7", Gravity.CENTER);
        title.setPadding(0, 0, 0, dp(10));
        calories.setPadding(0, 0, 0, dp(6));
        macros.setPadding(0, 0, 0, dp(8));
        card.addView(title, matchWrap());
        card.addView(calories, matchWrap());
        card.addView(macros, matchWrap());
        card.addView(sub, matchWrap());
        mainHandler.postDelayed(this::finish, 2200);
    }

    private void showMacroError() {
        if (input != null) input.setEnabled(true);
        if (goButton != null) {
            goButton.setEnabled(true);
            goButton.setText("Go");
            goButton.setAlpha(1f);
        }
        if (helperText != null) {
            helperText.setText("Could not log those macros. Try 500 cal 35p 60c 12f.");
            helperText.setTextColor(Color.parseColor("#FBBF24"));
        }
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

    private MacroEntry parseMacroEntry(String raw) {
        if (raw == null) return null;
        String lower = raw.toLowerCase(Locale.US);
        boolean hasMacroCue = containsAny(lower,
                "cal", "cals", "kcal", "calorie", "calories", "macro", "macros",
                "protein", "prot", "carb", "carbs", "fat")
                || Pattern.compile("\\b\\d+(?:\\.\\d+)?\\s*[pcf]\\b").matcher(lower).find()
                || Pattern.compile("\\b[pcf]\\s*\\d+(?:\\.\\d+)?\\b").matcher(lower).find();
        if (!hasMacroCue) return null;

        double protein = parseMacroNumber(lower, "protein|prot", "p");
        double carbs = parseMacroNumber(lower, "carbs?|carbohydrates", "c");
        double fat = parseMacroNumber(lower, "fats?", "f");
        Double caloriesMatch = firstNumberMatch(
                lower,
                "(\\d+(?:\\.\\d+)?)\\s*(?:k?cal|cals?|calories)\\b",
                "\\b(?:k?cal|cals?|calories)\\s*(\\d+(?:\\.\\d+)?)");
        int calories = caloriesMatch != null
                ? (int) Math.round(caloriesMatch)
                : (int) Math.round((protein * 4) + (carbs * 4) + (fat * 9));

        if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null;

        String name = raw
                .replaceAll("(?i)\\b(add|log|track|quick|manual|macros?|calories?|cals?|kcal|protein|prot|carbs?|carbohydrates|fats?|grams?|meal|food)\\b", " ")
                .replaceAll("(?i)\\b\\d+(?:\\.\\d+)?\\s*[pcf]\\b", " ")
                .replaceAll("(?i)\\b[pcf]\\s*\\d+(?:\\.\\d+)?\\b", " ")
                .replaceAll("\\d+(?:\\.\\d+)?", " ")
                .replaceAll("[^A-Za-z0-9 ]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (name.length() < 2) name = "Manual macros";

        return new MacroEntry(name, calories, protein, carbs, fat);
    }

    private double parseMacroNumber(String text, String labelPattern, String compactLabel) {
        Double value = firstNumberMatch(
                text,
                "(\\d+(?:\\.\\d+)?)\\s*(?:g\\s*)?(?:" + labelPattern + ")\\b",
                "\\b(?:" + labelPattern + ")\\s*(\\d+(?:\\.\\d+)?)\\s*g?\\b",
                "\\b(\\d+(?:\\.\\d+)?)\\s*" + compactLabel + "\\b",
                "\\b" + compactLabel + "\\s*(\\d+(?:\\.\\d+)?)\\b");
        return value != null ? Math.max(0, value) : 0;
    }

    private Double firstNumberMatch(String text, String... patterns) {
        for (String pattern : patterns) {
            Matcher matcher = Pattern.compile(pattern, Pattern.CASE_INSENSITIVE).matcher(text);
            if (matcher.find()) {
                try {
                    return Double.parseDouble(matcher.group(1));
                } catch (Exception ignored) { }
            }
        }
        return null;
    }

    private String autoMealType() {
        int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        if (hour < 11) return "breakfast";
        if (hour < 16) return "lunch";
        if (hour < 21) return "dinner";
        return "snack";
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

    private static final class MacroEntry {
        final String name;
        final int calories;
        final double protein;
        final double carbs;
        final double fat;

        MacroEntry(String name, int calories, double protein, double carbs, double fat) {
            this.name = name;
            this.calories = calories;
            this.protein = protein;
            this.carbs = carbs;
            this.fat = fat;
        }
    }
}
