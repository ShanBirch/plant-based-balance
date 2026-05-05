package com.fitgotchi.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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

    private static final String ACTION_QUICK_MEAL = "com.fitgotchi.app.ACTION_QUICK_MEAL";
    private static final String ACTION_ASK_BALANCE_ROUTE = "com.fitgotchi.app.ACTION_ASK_BALANCE_ROUTE";
    private static final String EXTRA_ASK_BALANCE_TARGET = "balance_target";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void saveSnapshot(Context context, String json) {
        if (json == null || json.trim().isEmpty()) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(SNAPSHOT_KEY, json).apply();
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
            saveSnapshot(context, snap.toString());
        } catch (Exception ignored) {}
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, CalorieTrackerWidgetProvider.class));
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_calorie_tracker);
        Snapshot snap = Snapshot.load(context);

        int remaining = snap.calorieGoal - snap.calories;
        String remainingLabel = Math.abs(remaining) + (remaining >= 0 ? " kcal left" : " kcal over");
        int progress = snap.calorieGoal > 0
            ? Math.min(100, Math.max(0, (int) Math.round((snap.calories * 100.0) / snap.calorieGoal)))
            : 0;

        views.setTextViewText(R.id.widget_calorie_remaining, remainingLabel);
        views.setTextViewText(R.id.widget_calorie_total, snap.calories + " / " + snap.calorieGoal + " kcal");
        views.setTextViewText(R.id.widget_calorie_meals, snap.mealCount + " meal" + (snap.mealCount == 1 ? "" : "s"));
        views.setProgressBar(R.id.widget_calorie_progress, 100, progress, false);
        views.setTextViewText(R.id.widget_calorie_protein, "P " + snap.protein + "/" + snap.proteinGoal + "g");
        views.setTextViewText(R.id.widget_calorie_carbs, "C " + snap.carbs + "/" + snap.carbsGoal + "g");
        views.setTextViewText(R.id.widget_calorie_fat, "F " + snap.fat + "/" + snap.fatGoal + "g");
        views.setTextViewText(R.id.widget_calorie_updated, snap.updatedLabel);

        views.setOnClickPendingIntent(R.id.widget_calorie_root,
            routeIntent(context, appWidgetId + 10, "calorie-tracker"));
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

    private static class Snapshot {
        int calories = 0;
        int calorieGoal = 2000;
        int protein = 0;
        int proteinGoal = 50;
        int carbs = 0;
        int carbsGoal = 250;
        int fat = 0;
        int fatGoal = 70;
        int mealCount = 0;
        String updatedLabel = "Open Balance to sync";

        static Snapshot load(Context context) {
            Snapshot snap = new Snapshot();
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String raw = prefs.getString(SNAPSHOT_KEY, null);
                if (raw == null || raw.trim().isEmpty()) return snap;
                JSONObject json = new JSONObject(raw);
                snap.calories = round(json.optDouble("calories", 0));
                snap.calorieGoal = Math.max(1, round(json.optDouble("calorieGoal", 2000)));
                snap.protein = round(json.optDouble("protein", 0));
                snap.proteinGoal = Math.max(1, round(json.optDouble("proteinGoal", 50)));
                snap.carbs = round(json.optDouble("carbs", 0));
                snap.carbsGoal = Math.max(1, round(json.optDouble("carbsGoal", 250)));
                snap.fat = round(json.optDouble("fat", 0));
                snap.fatGoal = Math.max(1, round(json.optDouble("fatGoal", 70)));
                snap.mealCount = Math.max(0, json.optInt("mealCount", 0));
                long updatedAt = json.optLong("updatedAt", 0);
                if (updatedAt > 0) snap.updatedLabel = "Synced " + formatTime(updatedAt);
            } catch (Exception ignored) {}
            return snap;
        }

        private static int round(double value) {
            return (int) Math.round(value);
        }

        private static String formatTime(long millis) {
            return new java.text.SimpleDateFormat("h:mm a", java.util.Locale.getDefault())
                .format(new java.util.Date(millis));
        }
    }
}
