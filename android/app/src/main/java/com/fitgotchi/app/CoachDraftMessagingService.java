package com.fitgotchi.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
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
    public static final String EXTRA_CLIENT_MESSAGE = "clientMessage";
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
        // Optional channel hint shown as the small subText in the top bar of
        // the notification (e.g. "Balance IG", "Balance FB"). Empty for
        // legacy in-app DMs that didn't pass one through.
        final String channelLabel = safe(data.get("channelLabel"));
        // Separate clientMessage field — falls back to parsing the legacy
        // combined body format for older server payloads that still use the
        // "clientMsg"\n→ draft shape.
        String clientMessageRaw = safe(data.get(EXTRA_CLIENT_MESSAGE));
        if (clientMessageRaw.isEmpty()) {
            clientMessageRaw = extractClientMessageFromBody(body);
        }
        final String clientMessage = clientMessageRaw;

        if (alertId.isEmpty() || clientId.isEmpty()) {
            Log.w(TAG, "Missing alertId/clientId, falling back to Capacitor default");
            super.onMessageReceived(new RemoteMessage.Builder("fallback").setData(data).build());
            return;
        }

        ensureChannel();

        int notificationId = notificationIdFor(alertId);

        // --- Reply action with RemoteInput -----------------------------------
        // The draft is offered as a single suggestion chip above the input
        // field. On Android Q+ we explicitly set EDIT_CHOICES_BEFORE_SENDING
        // so tapping the chip drops the draft into the input box for editing
        // (rather than the default AUTO behaviour, which can auto-send the
        // suggestion immediately on some OEMs/versions). The Send notification
        // action already handles "send as-is" for the no-edit case.
        RemoteInput.Builder remoteInputBuilder = new RemoteInput.Builder(KEY_REPLY_TEXT)
                .setLabel(draftText.isEmpty() ? "Type a reply…" : "Tap draft to edit, or type your own")
                .setAllowFreeFormInput(true);
        if (!draftText.isEmpty()) {
            remoteInputBuilder.setChoices(new CharSequence[]{draftText});
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                remoteInputBuilder.setEditChoicesBeforeSending(
                        RemoteInput.EDIT_CHOICES_BEFORE_SENDING_ENABLED);
            }
        }
        RemoteInput remoteInput = remoteInputBuilder.build();

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

        // --- One-tap Send action ---------------------------------------------
        // Fires CoachReplyReceiver with ACTION_SEND_AS_DRAFTED — no RemoteInput,
        // no edit step. The receiver sends the AI draft verbatim to the server
        // and delivers via the same CoachReplyWorker path. Only added when
        // there's actually a draft to send.
        Intent sendIntent = new Intent(this, CoachReplyReceiver.class)
                .setAction(CoachReplyReceiver.ACTION_SEND_AS_DRAFTED)
                .putExtra(EXTRA_ALERT_ID, alertId)
                .putExtra(EXTRA_CLIENT_ID, clientId)
                .putExtra(EXTRA_CLIENT_NAME, clientName)
                .putExtra(EXTRA_DRAFT_TEXT, draftText)
                .putExtra(EXTRA_NOTIFICATION_ID, notificationId);

        int sendFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // No RemoteInput on this one — immutable is fine.
            sendFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent sendPendingIntent = PendingIntent.getBroadcast(
                this,
                notificationId + 2, // distinct requestCode from reply (n) and open (n+1)
                sendIntent,
                sendFlags
        );

        NotificationCompat.Action sendAction = new NotificationCompat.Action.Builder(
                android.R.drawable.ic_menu_send,
                "Send",
                sendPendingIntent)
                .setShowsUserInterface(false)
                .build();

        // --- "Later" action — opens CoachScheduleActivity (translucent dialog
        // overlay) so Shannon can pick a delay (5/15/30/60/120 min) and
        // optionally edit the draft before scheduling. setShowsUserInterface
        // is true here BECAUSE we need the picker UI; the system uses that
        // hint to decide whether to dismiss the shade animation.
        Intent laterIntent = new Intent(this, CoachScheduleActivity.class)
                .setAction(CoachScheduleActivity.ACTION_SCHEDULE_REPLY)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(EXTRA_ALERT_ID, alertId)
                .putExtra(EXTRA_CLIENT_ID, clientId)
                .putExtra(EXTRA_CLIENT_NAME, clientName)
                .putExtra(EXTRA_DRAFT_TEXT, draftText)
                .putExtra(EXTRA_NOTIFICATION_ID, notificationId);

        int laterFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            laterFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent laterPendingIntent = PendingIntent.getActivity(
                this,
                notificationId + 3, // distinct requestCode from reply (n) / open (n+1) / send (n+2)
                laterIntent,
                laterFlags
        );

        NotificationCompat.Action laterAction = new NotificationCompat.Action.Builder(
                android.R.drawable.ic_menu_recent_history,
                "Later",
                laterPendingIntent)
                .setShowsUserInterface(true)
                .build();

        // --- "Open" action — when the server passed an openUrl (e.g. the
        // Instagram or Messenger inbox URL for ManyChat alerts), launch that
        // so Shannon lands directly in the source app where the message came
        // from. Falls back to the Balance admin dashboard for in-app DMs or
        // any payload that didn't carry openUrl.
        final String openUrl = safe(data.get("openUrl"));
        Intent openIntent;
        if (!openUrl.isEmpty()) {
            openIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(openUrl))
                    .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        } else {
            openIntent = new Intent(this, MainActivity.class)
                    .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    .putExtra(EXTRA_ALERT_ID, alertId)
                    .putExtra("open_coach_alert", true);
        }

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
        // Draft preview authored by a non-self Person so Android keeps it
        // visible in collapsed AND reply-mode views. When the draft was
        // authored by shannonPerson (the MessagingStyle user), Android's
        // inline-reply UI suppressed it — Shannon only saw the incoming
        // client message and an empty "Edit reply…" field, making the AI
        // suggestion invisible at exactly the moment it's needed.
        Person draftPerson = new Person.Builder()
                .setName("✏️ Draft reply")
                .build();

        // Don't set a conversation title — Android already uses the
        // contentTitle (set further down) as the bold header. Setting both
        // led to "indie_fixie" appearing as the header AND prefixed on the
        // message bubble, which read as duplication.
        NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(shannonPerson);
        // Use the explicit clientMessage field when present — otherwise fall
        // back to the body (with the quote/arrow wrapper stripped) for older
        // server payloads.
        CharSequence incomingMsg = clientMessage.isEmpty()
                ? stripQuoteWrapping(body)
                : clientMessage;
        if (incomingMsg != null && incomingMsg.length() > 0) {
            style.addMessage(incomingMsg, System.currentTimeMillis(), clientPerson);
        }

        // Post the full, untruncated draft as a second incoming-style message
        // so it renders in every notification state — collapsed preview,
        // chevron-expanded view, and the inline reply (Edit) state. +1ms
        // keeps it stably ordered after the client message.
        if (!draftText.isEmpty()) {
            style.addMessage(draftText, System.currentTimeMillis() + 1, draftPerson);
        }

        // --- Build + post -----------------------------------------------------
        int smallIcon = resolveSmallIcon();

        // Lead contentText with the DRAFT — that's what Shannon needs to see
        // to decide "send / edit / skip". The client message shows as a
        // subtitle (setSubText) and in the MessagingStyle expanded view, so
        // he still has the context when he wants it. When there's no draft
        // (simple reply path) we fall back to the raw body.
        String previewText = !draftText.isEmpty() ? draftText : body;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(smallIcon)
                .setContentTitle(title.isEmpty() ? clientName : title)
                .setContentText(previewText)
                .setStyle(style)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                .setAutoCancel(true)
                .setContentIntent(openPendingIntent);

        // Action order matters — leftmost first. Send is the primary path
        // (one-tap fire). Edit lets Shannon tweak the draft via RemoteInput.
        // Later opens CoachScheduleActivity (delay picker). Open is reachable
        // by tapping the notification body (setContentIntent below) so we
        // don't need a 4th visible button — Android only renders 3 reliably,
        // and we'd lose Later or Edit on devices that collapse extras.
        // Send + Later only appear when there's an actual draft to fire
        // (simple-reply alerts skip both).
        if (!draftText.isEmpty()) {
            builder.addAction(sendAction);
        }
        builder.addAction(replyAction);
        if (!draftText.isEmpty()) {
            builder.addAction(laterAction);
        } else {
            // No draft to schedule — fall back to showing Open as the third
            // action so simple-reply alerts still have a tap-target into the
            // source app.
            builder.addAction(openAction);
        }

        // SubText (small text in the notification top bar). Prefer the channel
        // hint ("Balance IG", "Balance FB") when present — that's the source
        // identifier Shannon scans for. Fall back to the legacy "From <name>"
        // form for older payloads that don't carry channelLabel.
        if (!channelLabel.isEmpty()) {
            builder.setSubText(channelLabel);
        } else if (!clientMessage.isEmpty()) {
            builder.setSubText("From " + (clientName.isEmpty() ? "client" : clientName));
        }

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

    /**
     * Backwards-compat helper for payloads that predate the separate
     * `clientMessage` FCM data field. Extracts the quoted client message from
     * the legacy combined body: `"client msg"\n→ draft`.
     */
    private static String extractClientMessageFromBody(String body) {
        if (body == null || body.isEmpty()) return "";
        CharSequence stripped = stripQuoteWrapping(body);
        return stripped == null ? "" : stripped.toString();
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }
}
