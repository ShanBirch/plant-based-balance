package com.fitgotchi.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Custom FirebaseMessagingService that adds inline-reply support for coach DM
 * drafts on top of Capacitor's default push-notifications plugin.
 *
 * Extends {@link MessagingService} so that non-coach pushes (regular DMs, meal
 * reminders, battle invites, etc.) continue to flow through Capacitor's
 * JS-side pipeline exactly as before. Only data-only messages with
 * <code>data.type == "coach_draft_ready"</code> are intercepted here — we
 * build a {@link NotificationCompat} using {@link androidx.core.app.RemoteInput}
 * so Shannon can edit + send the AI-drafted reply directly from the
 * notification shade or lockscreen, without ever opening the app.
 *
 * The reply text is delivered to {@link CoachReplyReceiver} which forwards it
 * to the server-side /.netlify/functions/send-coach-reply endpoint.
 *
 * Matching manifest entry (AndroidManifest.xml):
 * <pre>
 *   &lt;service android:name=".CoachDraftMessagingService" android:exported="false"&gt;
 *       &lt;intent-filter&gt;
 *           &lt;action android:name="com.google.firebase.MESSAGING_EVENT" /&gt;
 *       &lt;/intent-filter&gt;
 *   &lt;/service&gt;
 *   &lt;service android:name="com.capacitorjs.plugins.pushnotifications.MessagingService"
 *            tools:node="remove" /&gt;
 * </pre>
 */
public class CoachDraftMessagingService extends MessagingService {

    private static final String TAG = "CoachDraftMsg";

    /** Channel id used for the rich draft-ready notification. */
    public static final String CHANNEL_ID = "coach-drafts";

    /** RemoteInput key — matches {@link CoachReplyReceiver#KEY_REPLY_TEXT}. */
    public static final String KEY_REPLY_TEXT = "coach_reply_text";

    /** Diagnostic beacon so we can verify this service is actually running from afar. */
    private static final String DIAG_ENDPOINT = "https://plantbased-balance.org/.netlify/functions/push-diag";
    private static final ExecutorService DIAG_EXECUTOR = Executors.newSingleThreadExecutor();

    /** Intent extras — keep in sync with CoachReplyReceiver. */
    public static final String EXTRA_ALERT_ID = "alertId";
    public static final String EXTRA_CLIENT_ID = "clientId";
    public static final String EXTRA_CLIENT_NAME = "clientName";
    public static final String EXTRA_DRAFT_TEXT = "draftText";
    public static final String EXTRA_NOTIFICATION_ID = "notificationId";

    /** Stable-but-unique notification id derived from alertId hash. */
    private static int notificationIdFor(String alertId) {
        if (alertId == null || alertId.isEmpty()) {
            return 7000 + (int) (System.currentTimeMillis() % 1000);
        }
        // Bucket into a small positive int so repeat pushes for the same alert
        // replace the previous notification instead of stacking.
        return 7000 + (Math.abs(alertId.hashCode()) % 100000);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String type = data != null ? data.get("type") : null;
        boolean hasNotificationBlock = remoteMessage.getNotification() != null;

        Log.d(TAG, "onMessageReceived: type=" + type + " hasNotificationBlock=" + hasNotificationBlock
                + " dataKeys=" + (data == null ? "null" : data.keySet().toString()));

        // Beacon so we can verify from Netlify logs that this service is the
        // one receiving pushes. Fire-and-forget — no blocking on the network.
        sendDiagnosticBeacon("onMessageReceived", type, hasNotificationBlock, data);

        if (!"coach_draft_ready".equals(type)) {
            // Not ours — let Capacitor's plugin handle it (meal reminders,
            // regular DMs, battle invites, etc.).
            super.onMessageReceived(remoteMessage);
            return;
        }

        try {
            showCoachDraftNotification(data);
            sendDiagnosticBeacon("notification_built", type, hasNotificationBlock, data);
        } catch (Exception e) {
            Log.e(TAG, "Failed to show coach draft notification", e);
            sendDiagnosticBeacon("notification_error", type, hasNotificationBlock,
                    data, e.getClass().getSimpleName() + ": " + e.getMessage());
            // Fall back to default handling so Shannon still sees SOMETHING.
            super.onMessageReceived(remoteMessage);
        }
    }

    private void sendDiagnosticBeacon(String event, String type, boolean hasNotif,
                                      Map<String, String> data) {
        sendDiagnosticBeacon(event, type, hasNotif, data, null);
    }

    private void sendDiagnosticBeacon(String event, String type, boolean hasNotif,
                                      Map<String, String> data, String error) {
        DIAG_EXECUTOR.submit(() -> {
            HttpURLConnection conn = null;
            try {
                JSONObject payload = new JSONObject();
                payload.put("service", "CoachDraftMessagingService");
                payload.put("event", event);
                payload.put("type", type == null ? "null" : type);
                payload.put("hasNotifBlock", hasNotif);
                payload.put("dataKeys", data == null ? "null" : data.keySet().toString());
                payload.put("alertIdPresent", data != null && data.get(EXTRA_ALERT_ID) != null);
                payload.put("draftPresent", data != null && data.get(EXTRA_DRAFT_TEXT) != null
                        && !data.get(EXTRA_DRAFT_TEXT).isEmpty());
                if (error != null) payload.put("error", error);

                URL url = new URL(DIAG_ENDPOINT);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(3000);
                conn.setReadTimeout(5000);
                byte[] body = payload.toString().getBytes("UTF-8");
                conn.setFixedLengthStreamingMode(body.length);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body);
                }
                conn.getResponseCode();
            } catch (Exception e) {
                Log.w(TAG, "diag beacon failed: " + e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "onNewToken: " + token.substring(0, Math.min(20, token.length())) + "...");
    }

    /**
     * Build a {@link NotificationCompat} with inline reply + "Open" actions and
     * post it to the notification shade. Uses {@link NotificationCompat.MessagingStyle}
     * so the system renders it like an IM conversation (same styling Gmail and
     * Messages use for their inline-reply actions).
     */
    private void showCoachDraftNotification(Map<String, String> data) {
        final String alertId = safe(data.get(EXTRA_ALERT_ID));
        final String clientId = safe(data.get(EXTRA_CLIENT_ID));
        final String clientName = safe(data.get(EXTRA_CLIENT_NAME));
        final String draftText = safe(data.get(EXTRA_DRAFT_TEXT));
        final String title = safe(data.get("title"));
        final String body = safe(data.get("body"));

        if (alertId.isEmpty() || clientId.isEmpty()) {
            Log.w(TAG, "Missing alertId/clientId, falling back to Capacitor default");
            super.onMessageReceived(new RemoteMessage.Builder("fallback").setData(data).build());
            return;
        }

        ensureChannel();

        int notificationId = notificationIdFor(alertId);

        // --- Reply action with RemoteInput -----------------------------------
        RemoteInput remoteInput = new RemoteInput.Builder(KEY_REPLY_TEXT)
                .setLabel("Edit reply…")
                // Pre-fill: lets Shannon tap Send without typing if the draft is good.
                // If there's no draft (simple reply), we leave choices empty — the
                // inline field still appears so he can type a custom reply.
                .setChoices(draftText.isEmpty() ? null : new CharSequence[]{draftText})
                .setAllowFreeFormInput(true)
                .build();

        Intent replyIntent = new Intent(this, CoachReplyReceiver.class)
                .setAction(CoachReplyReceiver.ACTION_SEND_REPLY)
                .putExtra(EXTRA_ALERT_ID, alertId)
                .putExtra(EXTRA_CLIENT_ID, clientId)
                .putExtra(EXTRA_CLIENT_NAME, clientName)
                .putExtra(EXTRA_DRAFT_TEXT, draftText)
                .putExtra(EXTRA_NOTIFICATION_ID, notificationId);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            piFlags |= PendingIntent.FLAG_MUTABLE; // RemoteInput requires mutable
        }
        PendingIntent replyPendingIntent = PendingIntent.getBroadcast(
                this,
                notificationId,
                replyIntent,
                piFlags
        );

        // Action label: "Edit" makes it explicit that tapping opens the inline
        // text field to tweak the AI draft before sending (the default "Send"
        // label was read as "fires immediately with no chance to review").
        // The underlying intent + RemoteInput still delivers the final text —
        // edited or untouched — to CoachReplyReceiver.
        NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
                android.R.drawable.ic_menu_edit,
                "Edit",
                replyPendingIntent)
                .addRemoteInput(remoteInput)
                .setAllowGeneratedReplies(true)
                .setShowsUserInterface(false) // stays in shade, no app open required
                .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
                .build();

        // --- "Open" action — launches the admin dashboard alert view ---------
        Intent openIntent = new Intent(this, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(EXTRA_ALERT_ID, alertId)
                .putExtra("open_coach_alert", true);

        int openFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            openFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent openPendingIntent = PendingIntent.getActivity(
                this,
                notificationId + 1,
                openIntent,
                openFlags
        );

        NotificationCompat.Action openAction = new NotificationCompat.Action.Builder(
                android.R.drawable.ic_menu_view,
                "Open",
                openPendingIntent)
                .build();

        // --- MessagingStyle ---------------------------------------------------
        // Represent the client as the sender so the notification reads like an
        // incoming chat message; Shannon's reply surface appears underneath.
        Person clientPerson = new Person.Builder()
                .setName(clientName.isEmpty() ? "Client" : clientName)
                .setKey(clientId)
                .build();
        Person shannonPerson = new Person.Builder().setName("You").build();

        NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(shannonPerson)
                .setConversationTitle(title.isEmpty() ? clientName : title)
                .addMessage(stripQuoteWrapping(body), System.currentTimeMillis(), clientPerson);

        // Draft preview — posting the full, untruncated draft as a "self"
        // message (shannonPerson == MessagingStyle user) makes the expanded
        // notification show the whole AI-drafted reply underneath the signal
        // reason. The collapsed preview still uses the short body/contentText
        // that FCM sent, but tapping the chevron reveals everything so Shannon
        // can read the full message before hitting Edit/Send.
        if (!draftText.isEmpty()) {
            style.addMessage(draftText, System.currentTimeMillis(), shannonPerson);
        }

        // --- Build + post -----------------------------------------------------
        int smallIcon = resolveSmallIcon();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(smallIcon)
                .setContentTitle(title.isEmpty() ? clientName : title)
                .setContentText(body)
                .setStyle(style)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                .setAutoCancel(true)
                .setContentIntent(openPendingIntent)
                .addAction(replyAction)
                .addAction(openAction);

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(notificationId, builder.build());
        }

        // Still relay to the JS layer so the in-app badge / unread state
        // updates if Shannon has the app open in the foreground. Capacitor's
        // MessagingService.onMessageReceived only calls sendRemoteMessage, which
        // is a no-op unless the plugin is active — safe to always call.
        try {
            super.onMessageReceived(new RemoteMessage.Builder("coach-draft-relay")
                    .setData(data).build());
        } catch (Exception ignored) {
            // Relaying is best-effort — already delivered the real notification.
        }
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel channel = nm.getNotificationChannel(CHANNEL_ID);
        if (channel != null) return;
        channel = new NotificationChannel(
                CHANNEL_ID,
                "Coach drafts",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Incoming client DMs with AI-drafted reply suggestions");
        channel.enableVibration(true);
        channel.enableLights(true);
        nm.createNotificationChannel(channel);
    }

    /** Prefer our own notification icon if present; fall back to app icon. */
    private int resolveSmallIcon() {
        int stat = getResources().getIdentifier("ic_stat_notification", "drawable", getPackageName());
        if (stat != 0) return stat;
        return getApplicationInfo().icon;
    }

    /** The FCM body is `"msg"\n→ draft`; for the MessagingStyle preview strip the leading "→ draft". */
    private static CharSequence stripQuoteWrapping(String body) {
        if (body == null) return "";
        int arrow = body.indexOf("\n→");
        if (arrow > 0) {
            String quoted = body.substring(0, arrow).trim();
            // Remove surrounding quotation marks if present
            if (quoted.length() >= 2 && quoted.startsWith("\"") && quoted.endsWith("\"")) {
                quoted = quoted.substring(1, quoted.length() - 1);
            }
            return quoted;
        }
        return body;
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }
}
