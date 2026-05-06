package com.fitgotchi.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;

/**
 * Home-screen widget that looks like a small command/search bar.
 * Tapping it opens AskBalanceActivity, where typing and routing happen.
 */
public class AskBalanceWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_ask_balance);
            Intent intent = new Intent(context, AskBalanceActivity.class);
            intent.setAction(AskBalanceActivity.ACTION_ASK_BALANCE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;

            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    appWidgetId,
                    intent,
                    flags);
            views.setOnClickPendingIntent(R.id.widget_ask_balance_root, pendingIntent);
            views.setOnClickPendingIntent(R.id.widget_ask_balance_camera,
                    quickMealCameraIntent(context, appWidgetId + 1000, flags));
            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }

    private PendingIntent quickMealCameraIntent(Context context, int requestCode, int flags) {
        Intent intent = new Intent(context, QuickMealActivity.class);
        intent.setAction("com.fitgotchi.app.ACTION_QUICK_MEAL.camera.ask_widget." + requestCode);
        intent.putExtra("mode", "camera");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, requestCode, intent, flags);
    }
}
