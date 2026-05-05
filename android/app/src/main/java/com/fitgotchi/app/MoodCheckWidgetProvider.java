package com.fitgotchi.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

/**
 * Home-screen mood check widget. It keeps the same three-step flow as the app
 * card (mood, energy, stress) but turns each step into one tap inside the
 * widget.
 */
public class MoodCheckWidgetProvider extends AppWidgetProvider {
    private static final String ACTION_PICK = "com.fitgotchi.app.ACTION_MOOD_WIDGET_PICK";
    private static final String ACTION_RESET = "com.fitgotchi.app.ACTION_MOOD_WIDGET_RESET";
    private static final String ACTION_REFRESH = "com.fitgotchi.app.ACTION_MOOD_WIDGET_REFRESH";
    private static final String ACTION_ASK_BALANCE_ROUTE = "com.fitgotchi.app.ACTION_ASK_BALANCE_ROUTE";
    private static final String EXTRA_ASK_BALANCE_TARGET = "balance_target";
    private static final String EXTRA_WIDGET_ID = "widget_id";
    private static final String EXTRA_VALUE = "value";

    private static final String PREFS_NAME = "mood_check_widget_prefs";
    private static final String[] MOOD_LABELS = {"Awful", "Low", "Okay", "Good", "Great"};
    private static final String[] ENERGY_LABELS = {"Dead", "Tired", "Normal", "Good", "Wired"};
    private static final String[] STRESS_LABELS = {"Chill", "Easy", "Some", "High", "Max"};

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_PICK.equals(action)) {
            int appWidgetId = widgetId(intent);
            if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return;
            handlePick(context, appWidgetId, intent.getIntExtra(EXTRA_VALUE, 0));
            return;
        }
        if (ACTION_RESET.equals(action)) {
            int appWidgetId = widgetId(intent);
            if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return;
            reset(context, appWidgetId, "Pick your mood.");
            updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
            return;
        }
        if (ACTION_REFRESH.equals(action)) {
            int appWidgetId = widgetId(intent);
            if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return;
            refreshStatus(context, new int[] { appWidgetId }, goAsync());
            return;
        }

        super.onReceive(context, intent);
        if (AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)) {
            int[] ids = intent.getIntArrayExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS);
            if (ids != null && ids.length > 0) refreshStatus(context, ids, goAsync());
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, MoodCheckWidgetProvider.class));
        for (int id : ids) updateWidget(context, manager, id);
    }

    private void handlePick(Context context, int appWidgetId, int value) {
        if (value < 1 || value > 5) return;
        SharedPreferences prefs = prefs(context);
        if (prefs.getBoolean(key(appWidgetId, "saving"), false)) return;
        if (NativeMoodCheckLogger.loadCachedStatus(context).isCompleted(NativeMoodCheckLogger.currentWindow())) {
            updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
            return;
        }
        int step = prefs.getInt(key(appWidgetId, "step"), 0);
        if (step == 0) {
            prefs.edit()
                    .putInt(key(appWidgetId, "mood"), value)
                    .putInt(key(appWidgetId, "step"), 1)
                    .putString(key(appWidgetId, "message"), "Now energy.")
                    .apply();
            updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
            return;
        }
        if (step == 1) {
            prefs.edit()
                    .putInt(key(appWidgetId, "energy"), value)
                    .putInt(key(appWidgetId, "step"), 2)
                    .putString(key(appWidgetId, "message"), "Now stress.")
                    .apply();
            updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
            return;
        }

        prefs.edit()
                .putInt(key(appWidgetId, "stress"), value)
                .putBoolean(key(appWidgetId, "saving"), true)
                .putString(key(appWidgetId, "message"), "Logging...")
                .apply();
        updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
        syncLog(context, appWidgetId, goAsync());
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        NativeMoodCheckLogger.Status status = NativeMoodCheckLogger.loadCachedStatus(context);
        String window = NativeMoodCheckLogger.currentWindow();
        boolean completedWindow = status.isCompleted(window);
        SharedPreferences prefs = prefs(context);
        boolean saving = prefs.getBoolean(key(appWidgetId, "saving"), false);
        int step = prefs.getInt(key(appWidgetId, "step"), 0);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_mood_check);
        views.setViewVisibility(R.id.widget_mood_full, completedWindow ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.widget_mood_compact, completedWindow ? View.VISIBLE : View.GONE);

        views.setTextViewText(R.id.widget_mood_title, NativeMoodCheckLogger.windowLabel(window) + " Check-In");
        views.setTextViewText(R.id.widget_mood_step, saving ? "Saving" : stepTitle(step));
        views.setTextViewText(R.id.widget_mood_status, saving ? "Logging..." : prefs.getString(key(appWidgetId, "message"), "Pick your mood."));
        setOptionLabels(context, views, appWidgetId, step);
        views.setOnClickPendingIntent(R.id.widget_mood_reset, actionIntent(context, appWidgetId, ACTION_RESET, 30, 0));
        views.setOnClickPendingIntent(R.id.widget_mood_refresh, actionIntent(context, appWidgetId, ACTION_REFRESH, 31, 0));

        String compactTitle = status.allDone() ? "All done" : NativeMoodCheckLogger.windowLabel(window) + " done";
        String compactStatus = status.allDone()
                ? "+1 XP day complete"
                : "Next: " + NativeMoodCheckLogger.nextWindowLabel(status);
        views.setTextViewText(R.id.widget_mood_compact_title, compactTitle);
        views.setTextViewText(R.id.widget_mood_compact_status, compactStatus);
        views.setOnClickPendingIntent(R.id.widget_mood_compact, openAppIntent(context, appWidgetId + 70));

        manager.updateAppWidget(appWidgetId, views);
    }

    private static void setOptionLabels(Context context, RemoteViews views, int appWidgetId, int step) {
        String[] labels = step == 0 ? MOOD_LABELS : (step == 1 ? ENERGY_LABELS : STRESS_LABELS);
        int[] ids = {
                R.id.widget_mood_option_1,
                R.id.widget_mood_option_2,
                R.id.widget_mood_option_3,
                R.id.widget_mood_option_4,
                R.id.widget_mood_option_5
        };
        for (int i = 0; i < ids.length; i++) {
            int value = i + 1;
            views.setTextViewText(ids[i], labels[i]);
            views.setOnClickPendingIntent(ids[i], actionIntent(context, appWidgetId, ACTION_PICK, 40 + i, value));
        }
    }

    private static void syncLog(Context context, int appWidgetId, android.content.BroadcastReceiver.PendingResult pendingResult) {
        final Context appContext = context.getApplicationContext();
        SharedPreferences prefs = prefs(appContext);
        final int mood = prefs.getInt(key(appWidgetId, "mood"), 3);
        final int energy = prefs.getInt(key(appWidgetId, "energy"), 3);
        final int stress = prefs.getInt(key(appWidgetId, "stress"), 3);

        new Thread(() -> {
            try {
                NativeMoodCheckLogger.Result result = NativeMoodCheckLogger.log(appContext, mood, energy, stress);
                String message = result.allDone
                        ? (result.xpAwarded > 0 ? "All 3 done. +1 XP." : "All 3 done.")
                        : NativeMoodCheckLogger.windowLabel(result.window) + " logged.";
                reset(appContext, appWidgetId, message);
            } catch (NativeBalanceSession.AuthRequiredException e) {
                setSaving(appContext, appWidgetId, false, "Open Balance once to sync.");
            } catch (Exception e) {
                setSaving(appContext, appWidgetId, false, "Could not log. Tap reset.");
            }
            try {
                updateWidget(appContext, AppWidgetManager.getInstance(appContext), appWidgetId);
            } finally {
                if (pendingResult != null) pendingResult.finish();
            }
        }, "mood-widget-log").start();
    }

    private static void refreshStatus(Context context, int[] appWidgetIds, android.content.BroadcastReceiver.PendingResult pendingResult) {
        final Context appContext = context.getApplicationContext();
        new Thread(() -> {
            try {
                NativeMoodCheckLogger.getStatus(appContext);
            } catch (Exception ignored) { }
            try {
                AppWidgetManager manager = AppWidgetManager.getInstance(appContext);
                for (int id : appWidgetIds) updateWidget(appContext, manager, id);
            } finally {
                if (pendingResult != null) pendingResult.finish();
            }
        }, "mood-widget-refresh").start();
    }

    private static void reset(Context context, int appWidgetId, String message) {
        prefs(context).edit()
                .putInt(key(appWidgetId, "step"), 0)
                .putInt(key(appWidgetId, "mood"), 0)
                .putInt(key(appWidgetId, "energy"), 0)
                .putInt(key(appWidgetId, "stress"), 0)
                .putBoolean(key(appWidgetId, "saving"), false)
                .putString(key(appWidgetId, "message"), message)
                .apply();
    }

    private static void setSaving(Context context, int appWidgetId, boolean saving, String message) {
        prefs(context).edit()
                .putBoolean(key(appWidgetId, "saving"), saving)
                .putString(key(appWidgetId, "message"), message)
                .apply();
    }

    private static PendingIntent actionIntent(Context context, int appWidgetId, String action, int offset, int value) {
        Intent intent = new Intent(context, MoodCheckWidgetProvider.class);
        intent.setAction(action);
        intent.putExtra(EXTRA_WIDGET_ID, appWidgetId);
        intent.putExtra(EXTRA_VALUE, value);
        return PendingIntent.getBroadcast(context, appWidgetId * 100 + offset, intent, pendingFlags());
    }

    private static PendingIntent openAppIntent(Context context, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(ACTION_ASK_BALANCE_ROUTE);
        intent.putExtra(EXTRA_ASK_BALANCE_TARGET, "mood-check");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, pendingFlags());
    }

    private static int pendingFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return flags;
    }

    private static String stepTitle(int step) {
        if (step == 1) return "Energy";
        if (step == 2) return "Stress";
        return "Mood";
    }

    private static int widgetId(Intent intent) {
        return intent.getIntExtra(EXTRA_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static String key(int appWidgetId, String suffix) {
        return "w" + appWidgetId + "_" + suffix;
    }
}
