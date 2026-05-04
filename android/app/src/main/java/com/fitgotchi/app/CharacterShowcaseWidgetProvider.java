package com.fitgotchi.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.util.Base64;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;

/**
 * Square home-screen widget that shows the user's latest synced character
 * snapshot. The WebView owns the real 3D render and pushes a small PNG here
 * whenever the main character model settles.
 */
public class CharacterShowcaseWidgetProvider extends AppWidgetProvider {
    private static final String IMAGE_FILE = "character_widget_snapshot.png";
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
        try {
            JSONObject payload = new JSONObject(json);
            CharacterLiveWallpaperState.save(context, payload);
            String image = payload.optString("image", "");
            if (image.startsWith("data:")) {
                int comma = image.indexOf(',');
                if (comma >= 0 && comma + 1 < image.length()) {
                    image = image.substring(comma + 1);
                }
            }
            if (image.trim().isEmpty()) return;

            byte[] bytes = Base64.decode(image, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bitmap == null) return;

            File file = snapshotFile(context);
            FileOutputStream out = new FileOutputStream(file);
            try {
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
            } finally {
                out.close();
                bitmap.recycle();
            }
            updateAll(context);
        } catch (Exception ignored) {}
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, CharacterShowcaseWidgetProvider.class));
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_character_showcase);
        Bitmap snapshot = loadSnapshot(context);
        if (snapshot != null) {
            views.setImageViewBitmap(R.id.widget_character_image, snapshot);
        } else {
            views.setImageViewResource(R.id.widget_character_image, R.drawable.ic_widget_character_stand);
        }
        views.setOnClickPendingIntent(R.id.widget_character_root, openCharacterIntent(context, appWidgetId));
        manager.updateAppWidget(appWidgetId, views);
    }

    private static PendingIntent openCharacterIntent(Context context, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(ACTION_ASK_BALANCE_ROUTE);
        intent.putExtra(EXTRA_ASK_BALANCE_TARGET, "fitgotchi");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, pendingFlags());
    }

    private static int pendingFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return flags;
    }

    private static Bitmap loadSnapshot(Context context) {
        File file = snapshotFile(context);
        if (!file.exists()) return null;
        return BitmapFactory.decodeFile(file.getAbsolutePath());
    }

    private static File snapshotFile(Context context) {
        return new File(context.getFilesDir(), IMAGE_FILE);
    }
}
