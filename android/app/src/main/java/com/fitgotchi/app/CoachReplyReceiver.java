package com.fitgotchi.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;

import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.UnknownHostException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Receives the RemoteInput reply submitted from the coach-draft notification
 * shade/lockscreen action, posts it to the server, and updates the
 * notification to show "Sent ✓" (or an error with a retry option).
 *
 * This receiver runs briefly and then dies — it uses {@link #goAsync()} so the
 * network call can complete on a background thread without the system killing
 * the process. Keep execution under ~10s; the single POST to
 * /.netlify/functions/send-coach-reply typically returns in &lt;2s.
 *
 * Matching manifest entry (AndroidManifest.xml):
 * <pre>
 *   &lt;receiver android:name=".CoachReplyReceiver" android:exported="false" /&gt;
 * </pre>
 */
public class CoachReplyReceiver extends BroadcastReceiver {

    private static final String TAG = "CoachReplyRcv";

    /** Action emitted by the Send action's PendingIntent. */
    public static final String ACTION_SEND_REPLY = "com.fitgotchi.app.ACTION_SEND_COACH_REPLY";

    /** Matches {@link CoachDraftMessagingService#KEY_REPLY_TEXT}. */
    private static final String KEY_REPLY_TEXT = CoachDraftMessagingService.KEY_REPLY_TEXT;

    /** Endpoint that actually persists the reply (inserts a nudge + marks alert sent). */
    private static final String REPLY_ENDPOINT =
            "https://plantbased-balance.org/.netlify/functions/send-coach-reply";

    private static final ExecutorService NETWORK = Executors.newSingleThreadExecutor();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_SEND_REPLY.equals(intent.getAction())) return;

        Bundle remoteInput = RemoteInput.getResultsFromIntent(intent);
        if (remoteInput == null) {
            Log.w(TAG, "No RemoteInput bundle — ignoring");
            return;
        }
        CharSequence replyCs = remoteInput.getCharSequence(KEY_REPLY_TEXT);
        final String replyText = replyCs == null ? "" : replyCs.toString().trim();

        final String alertId = stringExtra(intent, CoachDraftMessagingService.EXTRA_ALERT_ID);
        final String clientId = stringExtra(intent, CoachDraftMessagingService.EXTRA_CLIENT_ID);
        final String clientName = stringExtra(intent, CoachDraftMessagingService.EXTRA_CLIENT_NAME);
        final String draftText = stringExtra(intent, CoachDraftMessagingService.EXTRA_DRAFT_TEXT);
        final int notificationId = intent.getIntExtra(
                CoachDraftMessagingService.EXTRA_NOTIFICATION_ID, -1);

        if (replyText.isEmpty() || alertId.isEmpty()) {
            Log.w(TAG, "Missing reply text or alertId — nothing to send");
            return;
        }

        // Update the notification to "Sending…" so the user sees instant feedback.
        updateNotificationProgress(context, notificationId, clientName,
                "Sending: " + replyText, draftText);

        final PendingResult pending = goAsync();
        NETWORK.submit(() -> {
            boolean ok = false;
            String errMessage = null;
            try {
                ok = postReplyWithRetry(alertId, replyText, draftText);
            } catch (Exception e) {
                errMessage = friendlyErrorMessage(e);
                Log.e(TAG, "postReply failed", e);
            }
            final boolean success = ok;
            final String finalErr = errMessage;
            MAIN.post(() -> {
                try {
                    if (success) {
                        updateNotificationSent(context, notificationId, clientName, replyText);
                        // Auto-dismiss after a short delay so the confirmation is visible briefly.
                        MAIN.postDelayed(() -> {
                            NotificationManager nm = (NotificationManager)
                                    context.getSystemService(Context.NOTIFICATION_SERVICE);
                            if (nm != null && notificationId != -1) {
                                nm.cancel(notificationId);
                            }
                        }, 2500);
                    } else {
                        updateNotificationFailed(context, notificationId, clientName, replyText,
                                alertId, clientId, draftText, finalErr);
                    }
                } finally {
                    pending.finish();
                }
            });
        });
    }

    /**
     * Wrap {@link #postReply} with up to 3 attempts for transient DNS failures.
     * UnknownHostException fails fast (usually &lt;500 ms) so three attempts plus
     * short backoff stays well within the goAsync() ~10s budget. Socket timeouts
     * are not retried — they mean the server/network is slow and another attempt
     * would blow the budget.
     */
    private boolean postReplyWithRetry(String alertId, String replyText, String draftText)
            throws IOException {
        UnknownHostException last = null;
        long[] backoffMs = {0L, 600L, 1500L};
        for (int attempt = 0; attempt < backoffMs.length; attempt++) {
            if (backoffMs[attempt] > 0) {
                try {
                    Thread.sleep(backoffMs[attempt]);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            try {
                return postReply(alertId, replyText, draftText);
            } catch (UnknownHostException e) {
                last = e;
                Log.w(TAG, "DNS failure on attempt " + (attempt + 1) + ": " + e);
            }
        }
        if (last != null) throw last;
        return false;
    }

    /** POST the reply to the server-side endpoint. Returns true on 200, false otherwise. */
    private boolean postReply(String alertId, String replyText, String draftText) throws IOException {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(REPLY_ENDPOINT);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(5000);

            JSONObject payload = new JSONObject();
            try {
                payload.put("alertId", alertId);
                payload.put("replyText", replyText);
                payload.put("draftText", draftText == null ? "" : draftText);
                payload.put("source", "android_inline_reply");
            } catch (Exception e) {
                throw new IOException("Failed to build JSON payload: " + e.getMessage());
            }

            byte[] body = payload.toString().getBytes("UTF-8");
            conn.setFixedLengthStreamingMode(body.length);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body);
            }

            int status = conn.getResponseCode();
            Log.d(TAG, "send-coach-reply response: " + status);
            return status >= 200 && status < 300;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void updateNotificationProgress(Context context, int notificationId,
                                            String clientName, String text, String draftText) {
        if (notificationId == -1) return;
        Person you = new Person.Builder().setName("You").build();
        Person client = new Person.Builder().setName(clientName.isEmpty() ? "Client" : clientName).build();
        NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(you)
                .setConversationTitle(clientName.isEmpty() ? "Client" : clientName)
                .addMessage(text, System.currentTimeMillis(), client);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context,
                CoachDraftMessagingService.CHANNEL_ID)
                .setSmallIcon(resolveSmallIcon(context))
                .setContentTitle(clientName.isEmpty() ? "Client" : clientName)
                .setContentText(text)
                .setStyle(style)
                .setProgress(0, 0, true)
                .setOngoing(true)
                .setAutoCancel(false)
                .setPriority(NotificationCompat.PRIORITY_HIGH);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(notificationId, builder.build());
    }

    private void updateNotificationSent(Context context, int notificationId,
                                        String clientName, String replyText) {
        if (notificationId == -1) return;
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context,
                CoachDraftMessagingService.CHANNEL_ID)
                .setSmallIcon(resolveSmallIcon(context))
                .setContentTitle("✓ Sent to " + (clientName.isEmpty() ? "client" : clientName))
                .setContentText(replyText)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(replyText))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_LOW);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(notificationId, builder.build());
    }

    private void updateNotificationFailed(Context context, int notificationId,
                                          String clientName, String replyText,
                                          String alertId, String clientId, String draftText,
                                          String errorMessage) {
        if (notificationId == -1) return;

        // Rebuild the reply action with the typed text as the new default so the
        // user can hit Retry without re-typing.
        RemoteInput remoteInput = new RemoteInput.Builder(KEY_REPLY_TEXT)
                .setLabel("Edit reply…")
                .setChoices(new CharSequence[]{replyText})
                .setAllowFreeFormInput(true)
                .build();

        Intent retryIntent = new Intent(context, CoachReplyReceiver.class)
                .setAction(ACTION_SEND_REPLY)
                .putExtra(CoachDraftMessagingService.EXTRA_ALERT_ID, alertId)
                .putExtra(CoachDraftMessagingService.EXTRA_CLIENT_ID, clientId)
                .putExtra(CoachDraftMessagingService.EXTRA_CLIENT_NAME, clientName)
                .putExtra(CoachDraftMessagingService.EXTRA_DRAFT_TEXT, draftText)
                .putExtra(CoachDraftMessagingService.EXTRA_NOTIFICATION_ID, notificationId);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            piFlags |= PendingIntent.FLAG_MUTABLE;
        }
        PendingIntent retryPi = PendingIntent.getBroadcast(context,
                notificationId, retryIntent, piFlags);

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
                .setContentTitle("✗ Couldn't send to " + (clientName.isEmpty() ? "client" : clientName))
                .setContentText(errLabel)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(errLabel + "\n\n\"" + replyText + "\""))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(false)
                .setDefaults(NotificationCompat.DEFAULT_VIBRATE)
                .addAction(retryAction);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(notificationId, builder.build());
    }

    /** Translate raw exceptions into a short, user-readable reason. */
    private static String friendlyErrorMessage(Throwable t) {
        if (t instanceof UnknownHostException || t instanceof SocketTimeoutException) {
            return "No internet connection";
        }
        Throwable cause = t;
        while (cause != null) {
            if (cause instanceof UnknownHostException || cause instanceof SocketTimeoutException) {
                return "No internet connection";
            }
            cause = cause.getCause();
        }
        String msg = t.getMessage();
        return (msg == null || msg.isEmpty()) ? "Network error" : msg;
    }

    private static int resolveSmallIcon(Context ctx) {
        int stat = ctx.getResources().getIdentifier("ic_stat_notification", "drawable", ctx.getPackageName());
        if (stat != 0) return stat;
        return ctx.getApplicationInfo().icon;
    }

    private static String stringExtra(Intent intent, String key) {
        String v = intent.getStringExtra(key);
        return v == null ? "" : v;
    }
}
