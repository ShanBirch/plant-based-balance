package com.fitgotchi.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import androidx.core.app.NotificationCompat;

final class DispatcherApprovalNotifier {
    private DispatcherApprovalNotifier() {}

    static int notificationIdFor(String batchId, String batchVersion) {
        return 9100 + Math.abs((batchId + ":" + batchVersion).hashCode() % 100000);
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager)
                context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(
                CoachDraftMessagingService.DISPATCHER_CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
                CoachDraftMessagingService.DISPATCHER_CHANNEL_ID,
                "Instagram approvals",
                NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("One-tap approval for reviewed Instagram dispatcher batches");
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }

    static void showApproving(Context context, int id, String batchId, String version) {
        show(context, id, "Approving Instagram batch…",
                label(batchId, version), true, false);
    }

    static void showApproved(Context context, int id, String batchId, String version) {
        show(context, id, "Instagram batch approved ✓",
                "The dispatcher will re-check every action before sending · " + label(batchId, version),
                false, false);
    }

    static void showRejected(Context context, int id, String batchId, String version, String reason) {
        show(context, id, "Instagram approval not completed",
                reason + " · " + label(batchId, version), false, true);
    }

    private static void show(Context context, int id, String title, String body,
                             boolean ongoing, boolean alert) {
        ensureChannel(context);
        int icon = context.getResources().getIdentifier(
                "ic_stat_notification", "drawable", context.getPackageName());
        if (icon == 0) icon = context.getApplicationInfo().icon;
        NotificationCompat.Builder builder = new NotificationCompat.Builder(
                context, CoachDraftMessagingService.DISPATCHER_CHANNEL_ID)
                .setSmallIcon(icon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setSubText("Balance IG")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setOnlyAlertOnce(!alert)
                .setOngoing(ongoing)
                .setAutoCancel(false);
        NotificationManager manager = (NotificationManager)
                context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(id, builder.build());
    }

    private static String label(String batchId, String version) {
        return batchId + " · v" + version;
    }
}
