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

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Home-screen weigh-in widget. Android widgets cannot show a keyboard inline,
 * so the widget uses a tiny stepper around the latest known weight and logs
 * directly through the native Supabase session.
 */
public class DailyWeighInWidgetProvider extends AppWidgetProvider {
    private static final String ACTION_PLUS = "com.fitgotchi.app.ACTION_WEIGH_WIDGET_PLUS";
    private static final String ACTION_MINUS = "com.fitgotchi.app.ACTION_WEIGH_WIDGET_MINUS";
    private static final String ACTION_LOG = "com.fitgotchi.app.ACTION_WEIGH_WIDGET_LOG";
    private static final String ACTION_REFRESH = "com.fitgotchi.app.ACTION_WEIGH_WIDGET_REFRESH";
    private static final String ACTION_ASK_BALANCE_ROUTE = "com.fitgotchi.app.ACTION_ASK_BALANCE_ROUTE";
    private static final String EXTRA_ASK_BALANCE_TARGET = "balance_target";
    private static final String EXTRA_WIDGET_ID = "widget_id";

    private static final String PREFS_NAME = "daily_weigh_in_widget_prefs";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_PLUS.equals(action) || ACTION_MINUS.equals(action)) {
            int appWidgetId = widgetId(intent);
            if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return;
            adjustWeight(context, appWidgetId, ACTION_PLUS.equals(action) ? 0.1 : -0.1);
            updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
            return;
        }
        if (ACTION_LOG.equals(action)) {
            int appWidgetId = widgetId(intent);
            if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return;
            setSaving(context, appWidgetId, true, "Logging...");
            updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
            syncLog(context, appWidgetId, goAsync());
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
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, DailyWeighInWidgetProvider.class));
        for (int id : ids) updateWidget(context, manager, id);
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        NativeWeighInLogger.Status status = NativeWeighInLogger.loadCachedStatus(context);
        SharedPreferences prefs = prefs(context);
        double selectedWeight = selectedWeight(context, appWidgetId, status.latestWeightKg);
        boolean saving = prefs.getBoolean(key(appWidgetId, "saving"), false);
        String defaultMessage = status.latestWeightKg > 0
                ? "Last: " + formatWeight(status.latestWeightKg)
                : "Tap Log after the scale.";
        String message = prefs.getString(key(appWidgetId, "message"), defaultMessage);
        if ("Tap Log after the scale.".equals(message)) message = defaultMessage;

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_daily_weigh_in);
        views.setViewVisibility(R.id.widget_weigh_full, status.loggedToday ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.widget_weigh_compact, status.loggedToday ? View.VISIBLE : View.GONE);

        views.setTextViewText(R.id.widget_weigh_weight, formatWeight(selectedWeight));
        views.setTextViewText(R.id.widget_weigh_status, saving ? "Logging..." : message);
        views.setTextViewText(R.id.widget_weigh_log, saving ? "..." : "Log");
        views.setOnClickPendingIntent(R.id.widget_weigh_minus, actionIntent(context, appWidgetId, ACTION_MINUS, 11));
        views.setOnClickPendingIntent(R.id.widget_weigh_plus, actionIntent(context, appWidgetId, ACTION_PLUS, 12));
        views.setOnClickPendingIntent(R.id.widget_weigh_log, actionIntent(context, appWidgetId, ACTION_LOG, 13));
        views.setOnClickPendingIntent(R.id.widget_weigh_refresh, actionIntent(context, appWidgetId, ACTION_REFRESH, 14));

        views.setTextViewText(R.id.widget_weigh_compact_weight, formatWeight(status.todayWeightKg));
        views.setTextViewText(R.id.widget_weigh_compact_status, "Logged today");
        views.setOnClickPendingIntent(R.id.widget_weigh_compact, openAppIntent(context, appWidgetId + 60));
        views.setOnClickPendingIntent(R.id.widget_weigh_open, openAppIntent(context, appWidgetId + 70));

        manager.updateAppWidget(appWidgetId, views);
    }

    private static void adjustWeight(Context context, int appWidgetId, double delta) {
        double weight = selectedWeight(context, appWidgetId, NativeWeighInLogger.loadCachedStatus(context).latestWeightKg);
        weight = Math.max(20.0, Math.min(500.0, Math.round((weight + delta) * 10.0) / 10.0));
        prefs(context).edit()
                .putString(key(appWidgetId, "date"), today())
                .putLong(key(appWidgetId, "weight_bits"), Double.doubleToLongBits(weight))
                .putString(key(appWidgetId, "message"), "Adjusted from last weigh-in.")
                .apply();
    }

    private static double selectedWeight(Context context, int appWidgetId, double fallback) {
        SharedPreferences prefs = prefs(context);
        if (!today().equals(prefs.getString(key(appWidgetId, "date"), ""))) {
            double reset = fallback > 0 ? fallback : 80.0;
            prefs.edit()
                    .putString(key(appWidgetId, "date"), today())
                    .putLong(key(appWidgetId, "weight_bits"), Double.doubleToLongBits(reset))
                    .apply();
            return reset;
        }
        return Double.longBitsToDouble(prefs.getLong(
                key(appWidgetId, "weight_bits"),
                Double.doubleToLongBits(fallback > 0 ? fallback : 80.0)));
    }

    private static void syncLog(Context context, int appWidgetId, android.content.BroadcastReceiver.PendingResult pendingResult) {
        final Context appContext = context.getApplicationContext();
        final double weight = selectedWeight(appContext, appWidgetId, NativeWeighInLogger.loadCachedStatus(appContext).latestWeightKg);
        new Thread(() -> {
            try {
                NativeWeighInLogger.Result result = NativeWeighInLogger.log(appContext, weight);
                setSaving(appContext, appWidgetId, false,
                        result.xpAwarded > 0 ? "+" + result.xpAwarded + " XP earned." : "Updated for today.");
            } catch (NativeBalanceSession.AuthRequiredException e) {
                setSaving(appContext, appWidgetId, false, "Open Balance once to sync.");
            } catch (Exception e) {
                setSaving(appContext, appWidgetId, false, "Could not log. Tap refresh.");
            }
            try {
                updateWidget(appContext, AppWidgetManager.getInstance(appContext), appWidgetId);
            } finally {
                if (pendingResult != null) pendingResult.finish();
            }
        }, "weigh-widget-log").start();
    }

    private static void refreshStatus(Context context, int[] appWidgetIds, android.content.BroadcastReceiver.PendingResult pendingResult) {
        final Context appContext = context.getApplicationContext();
        new Thread(() -> {
            try {
                NativeWeighInLogger.getStatus(appContext);
            } catch (Exception ignored) { }
            try {
                AppWidgetManager manager = AppWidgetManager.getInstance(appContext);
                for (int id : appWidgetIds) updateWidget(appContext, manager, id);
            } finally {
                if (pendingResult != null) pendingResult.finish();
            }
        }, "weigh-widget-refresh").start();
    }

    private static void setSaving(Context context, int appWidgetId, boolean saving, String message) {
        prefs(context).edit()
                .putBoolean(key(appWidgetId, "saving"), saving)
                .putString(key(appWidgetId, "message"), message)
                .apply();
    }

    private static PendingIntent actionIntent(Context context, int appWidgetId, String action, int offset) {
        Intent intent = new Intent(context, DailyWeighInWidgetProvider.class);
        intent.setAction(action);
        intent.putExtra(EXTRA_WIDGET_ID, appWidgetId);
        return PendingIntent.getBroadcast(context, appWidgetId * 100 + offset, intent, pendingFlags());
    }

    private static PendingIntent openAppIntent(Context context, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(ACTION_ASK_BALANCE_ROUTE);
        intent.putExtra(EXTRA_ASK_BALANCE_TARGET, "weigh-in");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, pendingFlags());
    }

    private static int pendingFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return flags;
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

    private static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private static String formatWeight(double weightKg) {
        return String.format(Locale.US, "%.1f kg", weightKg);
    }
}
