package com.fitgotchi.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Home-screen calorie widget. It renders the latest nutrition snapshot that
 * the web tracker writes into SharedPreferences via the NativePermissions
 * bridge, then routes quick logging actions into the native meal logger
 * overlay and opens full in-app meal surfaces when the web tracker owns them.
 */
public class CalorieTrackerWidgetProvider extends AppWidgetProvider {
    static final String PREFS_NAME = "nutrition_widget_prefs";
    static final String SNAPSHOT_KEY = "nutrition_snapshot";
    private static final String RANGE_KEY = "nutrition_range";

    private static final String ACTION_QUICK_MEAL = "com.fitgotchi.app.ACTION_QUICK_MEAL";
    private static final String ACTION_SET_RANGE = "com.fitgotchi.app.ACTION_SET_NUTRITION_RANGE";
    private static final String ACTION_ASK_BALANCE_ROUTE = "com.fitgotchi.app.ACTION_ASK_BALANCE_ROUTE";
    private static final String EXTRA_ASK_BALANCE_TARGET = "balance_target";
    private static final String EXTRA_RANGE = "nutrition_range";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void saveSnapshot(Context context, String json) {
        if (json == null || json.trim().isEmpty()) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit().putString(SNAPSHOT_KEY, json);
        try {
            JSONObject parsed = new JSONObject(json);
            String selectedRange = normalizeRange(parsed.optString("selectedRange", null));
            if (selectedRange != null) editor.putString(RANGE_KEY, selectedRange);
        } catch (Exception ignored) {}
        editor.apply();
        updateAll(context);
    }

    static void addMealToSnapshot(Context context, int calories, double protein, double carbs, double fat) {
        if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return;
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existing = prefs.getString(SNAPSHOT_KEY, null);
            JSONObject snap = existing != null ? new JSONObject(existing) : new JSONObject();
            String today = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
                .format(new java.util.Date());
            if (!today.equals(snap.optString("date", today))) {
                snap = new JSONObject();
                snap.put("date", today);
            }

            snap.put("calories", snap.optDouble("calories", 0) + calories);
            snap.put("protein", snap.optDouble("protein", 0) + protein);
            snap.put("carbs", snap.optDouble("carbs", 0) + carbs);
            snap.put("fat", snap.optDouble("fat", 0) + fat);
            snap.put("calorieGoal", snap.optDouble("calorieGoal", 2000));
            snap.put("proteinGoal", snap.optDouble("proteinGoal", 50));
            snap.put("carbsGoal", snap.optDouble("carbsGoal", 250));
            snap.put("fatGoal", snap.optDouble("fatGoal", 70));
            snap.put("mealCount", snap.optInt("mealCount", 0) + 1);
            snap.put("updatedAt", System.currentTimeMillis());

            JSONObject ranges = snap.optJSONObject("ranges");
            if (ranges != null) {
                JSONObject day = ranges.optJSONObject("day");
                boolean dayWasEmpty = day == null || day.optDouble("calories", 0) <= 0;
                addMealToPeriod(day, calories, protein, carbs, fat, true, dayWasEmpty);
                addMealToPeriod(ranges.optJSONObject("week"), calories, protein, carbs, fat, true, dayWasEmpty);
                addMealToPeriod(ranges.optJSONObject("month"), calories, protein, carbs, fat, true, dayWasEmpty);
            }
            saveSnapshot(context, snap.toString());
        } catch (Exception ignored) {}
    }

    private static void addMealToPeriod(JSONObject period, int calories, double protein, double carbs, double fat, boolean incrementMeal, boolean newLoggedDay) {
        if (period == null) return;
        try {
            period.put("calories", period.optDouble("calories", 0) + calories);
            period.put("protein", period.optDouble("protein", 0) + protein);
            period.put("carbs", period.optDouble("carbs", 0) + carbs);
            period.put("fat", period.optDouble("fat", 0) + fat);
            if (incrementMeal) period.put("mealCount", period.optInt("mealCount", 0) + 1);
            if (newLoggedDay) period.put("daysLogged", Math.max(period.optInt("daysLogged", 0) + 1, 1));
            period.put("updatedAt", System.currentTimeMillis());
        } catch (Exception ignored) {}
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, CalorieTrackerWidgetProvider.class));
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent != null && ACTION_SET_RANGE.equals(intent.getAction())) {
            String range = normalizeRange(intent.getStringExtra(EXTRA_RANGE));
            if (range == null) range = "day";
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(RANGE_KEY, range)
                .apply();
            updateAll(context);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_calorie_tracker);
        Snapshot snap = Snapshot.load(context);

        int remaining = snap.calorieGoal - snap.calories;
        String remainingLabel = formatNumber(Math.abs(remaining)) + (remaining >= 0 ? " kcal left" : " kcal over");
        int progress = snap.calorieGoal > 0
            ? Math.min(100, Math.max(0, (int) Math.round((snap.calories * 100.0) / snap.calorieGoal)))
            : 0;

        views.setTextViewText(R.id.widget_calorie_title, snap.title);
        views.setTextViewText(R.id.widget_calorie_remaining, remainingLabel);
        views.setTextViewText(R.id.widget_calorie_total, formatNumber(snap.calories) + " / " + formatNumber(snap.calorieGoal) + " kcal");
        views.setTextViewText(R.id.widget_calorie_meals, snap.countLabel());
        views.setProgressBar(R.id.widget_calorie_progress, 100, progress, false);
        views.setTextViewText(R.id.widget_calorie_protein, "P " + gramsLabel(snap.protein) + "/" + gramsLabel(snap.proteinGoal));
        views.setTextViewText(R.id.widget_calorie_carbs, "C " + gramsLabel(snap.carbs) + "/" + gramsLabel(snap.carbsGoal));
        views.setTextViewText(R.id.widget_calorie_fat, "F " + gramsLabel(snap.fat) + "/" + gramsLabel(snap.fatGoal));
        views.setTextViewText(R.id.widget_calorie_updated, snap.updatedLabel);
        setRangeButtonState(views, R.id.widget_calorie_range_day, "day".equals(snap.range));
        setRangeButtonState(views, R.id.widget_calorie_range_week, "week".equals(snap.range));
        setRangeButtonState(views, R.id.widget_calorie_range_month, "month".equals(snap.range));

        views.setOnClickPendingIntent(R.id.widget_calorie_root,
            routeIntent(context, appWidgetId + 10, "calorie-tracker"));
        views.setOnClickPendingIntent(R.id.widget_calorie_range_day,
            rangeIntent(context, appWidgetId + 11, "day"));
        views.setOnClickPendingIntent(R.id.widget_calorie_range_week,
            rangeIntent(context, appWidgetId + 12, "week"));
        views.setOnClickPendingIntent(R.id.widget_calorie_range_month,
            rangeIntent(context, appWidgetId + 13, "month"));
        views.setOnClickPendingIntent(R.id.widget_calorie_photo,
            quickMealIntent(context, appWidgetId + 20, "camera"));
        views.setOnClickPendingIntent(R.id.widget_calorie_barcode,
            quickMealIntent(context, appWidgetId + 30, "camera"));
        views.setOnClickPendingIntent(R.id.widget_calorie_text,
            quickMealIntent(context, appWidgetId + 40, "text"));
        views.setOnClickPendingIntent(R.id.widget_calorie_manual,
            quickMealIntent(context, appWidgetId + 50, "manual"));
        views.setOnClickPendingIntent(R.id.widget_calorie_build,
            quickMealIntent(context, appWidgetId + 60, "build"));
        views.setOnClickPendingIntent(R.id.widget_calorie_recent,
            quickMealIntent(context, appWidgetId + 70, "recent"));

        manager.updateAppWidget(appWidgetId, views);
    }

    private static void setRangeButtonState(RemoteViews views, int viewId, boolean active) {
        views.setInt(viewId, "setBackgroundResource", active
            ? R.drawable.widget_calorie_range_active
            : R.drawable.widget_calorie_range_inactive);
        views.setTextColor(viewId, active ? Color.parseColor("#DCFCE7") : Color.parseColor("#B7C3BD"));
    }

    private static PendingIntent rangeIntent(Context context, int requestCode, String range) {
        Intent intent = new Intent(context, CalorieTrackerWidgetProvider.class);
        intent.setAction(ACTION_SET_RANGE);
        intent.putExtra(EXTRA_RANGE, range);
        return PendingIntent.getBroadcast(context, requestCode, intent, pendingFlags());
    }

    private static PendingIntent quickMealIntent(Context context, int requestCode, String mode) {
        Intent intent = new Intent(context, QuickMealActivity.class);
        intent.setAction(ACTION_QUICK_MEAL + "." + mode + "." + requestCode);
        intent.putExtra("mode", mode);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, requestCode, intent, pendingFlags());
    }

    private static PendingIntent routeIntent(Context context, int requestCode, String target) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(ACTION_ASK_BALANCE_ROUTE);
        intent.putExtra(EXTRA_ASK_BALANCE_TARGET, target);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, pendingFlags());
    }

    private static int pendingFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return flags;
    }

    private static String normalizeRange(String range) {
        if ("day".equals(range) || "week".equals(range) || "month".equals(range)) return range;
        return null;
    }

    private static String formatNumber(int value) {
        return java.text.NumberFormat.getIntegerInstance(java.util.Locale.getDefault()).format(value);
    }

    private static String gramsLabel(int grams) {
        if (grams >= 1000) {
            double kg = grams / 1000.0;
            return String.format(java.util.Locale.getDefault(), kg >= 10 ? "%.0fkg" : "%.1fkg", kg);
        }
        return grams + "g";
    }

    private static class Snapshot {
        String range = "day";
        String title = "Today";
        String dateLabel = "Today";
        int calories = 0;
        int calorieGoal = 2000;
        int protein = 0;
        int proteinGoal = 50;
        int carbs = 0;
        int carbsGoal = 250;
        int fat = 0;
        int fatGoal = 70;
        int mealCount = 0;
        int daysLogged = 0;
        int periodDays = 1;
        String updatedLabel = "Open Balance to sync";

        static Snapshot load(Context context) {
            Snapshot snap = new Snapshot();
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String raw = prefs.getString(SNAPSHOT_KEY, null);
                if (raw == null || raw.trim().isEmpty()) return snap;
                JSONObject json = new JSONObject(raw);
                String selectedRange = normalizeRange(prefs.getString(RANGE_KEY, null));
                if (selectedRange == null) selectedRange = normalizeRange(json.optString("selectedRange", null));
                if (selectedRange == null) selectedRange = "day";
                snap.range = selectedRange;

                JSONObject period = null;
                JSONObject ranges = json.optJSONObject("ranges");
                if (ranges != null) {
                    period = ranges.optJSONObject(selectedRange);
                    if (period == null) period = ranges.optJSONObject("day");
                }
                if (period == null) period = json;

                snap.title = period.optString("title", titleForRange(selectedRange));
                snap.dateLabel = period.optString("dateLabel", snap.title);
                snap.calories = round(period.optDouble("calories", 0));
                snap.calorieGoal = Math.max(1, round(period.optDouble("calorieGoal", 2000)));
                snap.protein = round(period.optDouble("protein", 0));
                snap.proteinGoal = Math.max(1, round(period.optDouble("proteinGoal", 50)));
                snap.carbs = round(period.optDouble("carbs", 0));
                snap.carbsGoal = Math.max(1, round(period.optDouble("carbsGoal", 250)));
                snap.fat = round(period.optDouble("fat", 0));
                snap.fatGoal = Math.max(1, round(period.optDouble("fatGoal", 70)));
                snap.mealCount = Math.max(0, period.optInt("mealCount", json.optInt("mealCount", 0)));
                snap.daysLogged = Math.max(0, period.optInt("daysLogged", snap.mealCount > 0 ? 1 : 0));
                snap.periodDays = Math.max(1, period.optInt("periodDays", 1));
                long updatedAt = period.optLong("updatedAt", json.optLong("updatedAt", 0));
                if (updatedAt > 0) snap.updatedLabel = "Synced " + formatTime(updatedAt);
            } catch (Exception ignored) {}
            return snap;
        }

        String countLabel() {
            if ("day".equals(range)) {
                return mealCount + " meal" + (mealCount == 1 ? "" : "s");
            }
            return daysLogged + "/" + periodDays + " days";
        }

        private static int round(double value) {
            return (int) Math.round(value);
        }

        private static String titleForRange(String range) {
            if ("week".equals(range)) return "This week";
            if ("month".equals(range)) return "This month";
            return "Today";
        }

        private static String formatTime(long millis) {
            return new java.text.SimpleDateFormat("h:mm a", java.util.Locale.getDefault())
                .format(new java.util.Date(millis));
        }
    }
}
