package com.fitgotchi.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;

/**
 * Builds + posts the "Sending…" / "Sent" / "Couldn't send" notification states
 * for the coach inline-reply flow. Shared by {@link CoachReplyReceiver} (which
 * shows the immediate "Sending…" state while WorkManager queues the send) and
 * {@link CoachReplyWorker} (which flips it to success or failure once the POST
 * completes — or permanently fails after retries).
 */
final class CoachReplyNotifier {

    private CoachReplyNotifier() {}

    static void showSending(Context context, int notificationId, String clientName, String replyText) {
        if (notificationId == -1) return;
        String safeName = clientName == null || clientName.isEmpty() ? "Client" : clientName;
        Person you = new Person.Builder().setName("You").build();
        Person client = new Person.Builder().setName(safeName).build();
        NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(you)
                .setConversationTitle(safeName)
                .addMessage("Sending: " + replyText, System.currentTimeMillis(), client);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context,
                CoachDraftMessagingService.CHANNEL_ID)
                .setSmallIcon(resolveSmallIcon(context))
                .setContentTitle(safeName)
                .setContentText("Sending: " + replyText)
                .setStyle(style)
                .setProgress(0, 0, true)
                .setOngoing(true)
                .setAutoCancel(false)
                .setPriority(NotificationCompat.PRIORITY_HIGH);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(notificationId, builder.build());
    }

    static void showSent(Context context, int notificationId, String clientName, String replyText) {
        if (notificationId == -1) return;
        String safeName = clientName == null || clientName.isEmpty() ? "client" : clientName;
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context,
                CoachDraftMessagingService.CHANNEL_ID)
                .setSmallIcon(resolveSmallIcon(context))
                .setContentTitle("✓ Sent to " + safeName)
                .setContentText(replyText)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(replyText))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_LOW);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(notificationId, builder.build());
    }

    /**
     * Post the "Couldn't send" notification with a Retry action that re-fires
     * {@link CoachReplyReceiver} — tapping Retry re-enqueues a fresh Worker
     * with the typed text pre-filled.
     */
    static void showFailed(Context context, int notificationId, String clientName, String replyText,
                           String alertId, String clientId, String draftText, String errorMessage) {
        if (notificationId == -1) return;
        String safeName = clientName == null || clientName.isEmpty() ? "client" : clientName;

        RemoteInput remoteInput = new RemoteInput.Builder(CoachDraftMessagingService.KEY_REPLY_TEXT)
                .setLabel("Edit reply…")
                .setChoices(new CharSequence[]{replyText})
                .setAllowFreeFormInput(true)
                .build();

        Intent retryIntent = new Intent(context, CoachReplyReceiver.class)
                .setAction(CoachReplyReceiver.ACTION_SEND_REPLY)
                .putExtra(CoachDraftMessagingService.EXTRA_ALERT_ID, alertId)
                .putExtra(CoachDraftMessagingService.EXTRA_CLIENT_ID, clientId)
                .putExtra(CoachDraftMessagingService.EXTRA_CLIENT_NAME, clientName)
                .putExtra(CoachDraftMessagingService.EXTRA_DRAFT_TEXT, draftText)
                .putExtra(CoachDraftMessagingService.EXTRA_NOTIFICATION_ID, notificationId);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            piFlags |= PendingIntent.FLAG_MUTABLE;
        }
        PendingIntent retryPi = PendingIntent.getBroadcast(context, notificationId, retryIntent, piFlags);

        NotificationCompat.Action retryAction = new NotificationCompat.Action.Builder(
                android.R.drawable.ic_menu_send, "Retry", retryPi)
                .addRemoteInput(remoteInput)
                .setAllowGeneratedReplies(true)
                .setShowsUserInterface(false)
                .build();

        String errLabel = errorMessage == null || errorMessage.isEmpty()
                ? "Send failed — tap Retry"
                : "Send failed: " + errorMessage;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context,
                CoachDraftMessagingService.CHANNEL_ID)
                .setSmallIcon(resolveSmallIcon(context))
                .setContentTitle("✗ Couldn't send to " + safeName)
                .setContentText(errLabel)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(errLabel + "\n\n\"" + replyText + "\""))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(false)
                .setDefaults(NotificationCompat.DEFAULT_VIBRATE)
                .addAction(retryAction);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(notificationId, builder.build());
    }

    static void dismiss(Context context, int notificationId) {
        if (notificationId == -1) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(notificationId);
    }

    private static int resolveSmallIcon(Context ctx) {
        int stat = ctx.getResources().getIdentifier("ic_stat_notification", "drawable", ctx.getPackageName());
        if (stat != 0) return stat;
        return ctx.getApplicationInfo().icon;
    }
}
