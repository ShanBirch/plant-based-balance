package com.fitgotchi.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import androidx.core.app.RemoteInput;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

/**
 * Receives the RemoteInput reply submitted from the coach-draft notification
 * shade/lockscreen action and enqueues a {@link CoachReplyWorker} to actually
 * post it. The worker has a NetworkType.CONNECTED constraint plus exponential
 * backoff, so the reply lands even if the immediate send hits a DNS/network
 * failure (Doze, VPN, background data restrictions on targetSdk 34+).
 *
 * The receiver itself does no network — it just:
 *   1. Extracts the typed reply from RemoteInput
 *   2. Updates the notification to "Sending…" for instant feedback
 *   3. Enqueues CoachReplyWorker (unique name per alertId, REPLACE policy so
 *      tapping Retry supersedes any still-queued attempt)
 *
 * Matching manifest entry (AndroidManifest.xml):
 * <pre>
 *   &lt;receiver android:name=".CoachReplyReceiver" android:exported="false" /&gt;
 * </pre>
 */
public class CoachReplyReceiver extends BroadcastReceiver {

    private static final String TAG = "CoachReplyRcv";

    /** Action emitted by the inline-reply (Edit) action's PendingIntent. Carries
     *  Shannon's typed reply via RemoteInput. */
    public static final String ACTION_SEND_REPLY = "com.fitgotchi.app.ACTION_SEND_COACH_REPLY";

    /** Action emitted by the one-tap Send action's PendingIntent. Sends the AI
     *  draft as-is, no editing. */
    public static final String ACTION_SEND_AS_DRAFTED = "com.fitgotchi.app.ACTION_SEND_AS_DRAFTED";

    /** Matches {@link CoachDraftMessagingService#KEY_REPLY_TEXT}. */
    private static final String KEY_REPLY_TEXT = CoachDraftMessagingService.KEY_REPLY_TEXT;

    @Override
    public void onReceive(Context context, Intent intent) {
        final String action = intent.getAction();
        final boolean isSendAsDrafted = ACTION_SEND_AS_DRAFTED.equals(action);
        final boolean isInlineReply = ACTION_SEND_REPLY.equals(action);
        if (!isSendAsDrafted && !isInlineReply) return;

        final String alertId = stringExtra(intent, CoachDraftMessagingService.EXTRA_ALERT_ID);
        final String clientId = stringExtra(intent, CoachDraftMessagingService.EXTRA_CLIENT_ID);
        final String clientName = stringExtra(intent, CoachDraftMessagingService.EXTRA_CLIENT_NAME);
        final String draftText = stringExtra(intent, CoachDraftMessagingService.EXTRA_DRAFT_TEXT);
        final int notificationId = intent.getIntExtra(
                CoachDraftMessagingService.EXTRA_NOTIFICATION_ID, -1);

        final String replyText;
        if (isSendAsDrafted) {
            // One-tap Send button: fire the AI draft verbatim, no edit step.
            replyText = draftText.trim();
        } else {
            // Inline-reply (Edit) action: pull Shannon's typed text out of
            // the RemoteInput bundle.
            Bundle remoteInput = RemoteInput.getResultsFromIntent(intent);
            if (remoteInput == null) {
                Log.w(TAG, "No RemoteInput bundle on inline-reply intent");
                return;
            }
            CharSequence replyCs = remoteInput.getCharSequence(KEY_REPLY_TEXT);
            replyText = replyCs == null ? "" : replyCs.toString().trim();
        }

        if (replyText.isEmpty() || alertId.isEmpty()) {
            Log.w(TAG, "Missing reply text or alertId — nothing to send");
            return;
        }

        CoachReplyNotifier.showSending(context, notificationId, clientName, replyText);

        Data inputData = new Data.Builder()
                .putString(CoachReplyWorker.INPUT_ALERT_ID, alertId)
                .putString(CoachReplyWorker.INPUT_CLIENT_ID, clientId)
                .putString(CoachReplyWorker.INPUT_CLIENT_NAME, clientName)
                .putString(CoachReplyWorker.INPUT_DRAFT_TEXT, draftText)
                .putString(CoachReplyWorker.INPUT_REPLY_TEXT, replyText)
                .putInt(CoachReplyWorker.INPUT_NOTIFICATION_ID, notificationId)
                .build();

        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(CoachReplyWorker.class)
                .setInputData(inputData)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
                .addTag("coach-reply")
                .build();

        // Unique-name enqueue keyed on alertId so a Retry tap replaces any
        // previous in-flight/queued attempt for the same reply instead of
        // stacking duplicate sends. (send-coach-reply also dedupes server-side
        // via the coach_alerts status=pending check.)
        WorkManager.getInstance(context.getApplicationContext()).enqueueUniqueWork(
                "coach-reply-" + alertId,
                ExistingWorkPolicy.REPLACE,
                request);

        Log.d(TAG, "Enqueued CoachReplyWorker for alertId=" + alertId);
    }

    private static String stringExtra(Intent intent, String key) {
        String v = intent.getStringExtra(key);
        return v == null ? "" : v;
    }
}
