package com.fitgotchi.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Data;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.UnknownHostException;

/**
 * Posts the coach inline-reply to /.netlify/functions/send-coach-reply on
 * behalf of {@link CoachReplyReceiver}.
 *
 * Why a Worker instead of doing the POST directly from the receiver:
 * targetSdk 34+ broadcast receivers have heavily restricted background network
 * access (Doze, background-data limits, battery saver, Private DNS hiccups,
 * VPN drops). A 10-second goAsync() window with 3 in-line retries isn't enough
 * when DNS fails persistently for a stretch of minutes. WorkManager runs the
 * POST from the app's normal process context with a NetworkType.CONNECTED
 * constraint, exponential backoff, and persistence across reboots — so the
 * reply eventually lands even if the first attempt hits a DNS wall.
 *
 * Retry semantics:
 *   - 2xx: Result.success() → "Sent ✓" notification, auto-dismiss
 *   - 4xx: Result.failure()  → treat as permanent (alertId invalid / already
 *                              sent); show "Couldn't send" with retry action
 *   - 5xx / IOException / UnknownHostException: Result.retry() up to
 *     MAX_ATTEMPTS with WorkManager's exponential backoff (starts at 10s).
 *     After the final attempt, the next retry() call is treated as a final
 *     failure by surfacing the friendly message ourselves.
 */
public class CoachReplyWorker extends Worker {

    private static final String TAG = "CoachReplyWrk";

    static final String INPUT_ALERT_ID = "alertId";
    static final String INPUT_CLIENT_ID = "clientId";
    static final String INPUT_CLIENT_NAME = "clientName";
    static final String INPUT_DRAFT_TEXT = "draftText";
    static final String INPUT_REPLY_TEXT = "replyText";
    static final String INPUT_NOTIFICATION_ID = "notificationId";

    private static final String REPLY_ENDPOINT =
            "https://plantbased-balance.org/.netlify/functions/send-coach-reply";

    /** Total attempts (initial + retries). WorkManager backoff is exponential
     *  starting at 10s, so 5 attempts cover roughly 10s + 20s + 40s + 80s = ~2.5
     *  minutes of network-trouble tolerance before we surface a failure. */
    private static final int MAX_ATTEMPTS = 5;

    public CoachReplyWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Data input = getInputData();
        String alertId = input.getString(INPUT_ALERT_ID);
        String clientId = input.getString(INPUT_CLIENT_ID);
        String clientName = input.getString(INPUT_CLIENT_NAME);
        String draftText = input.getString(INPUT_DRAFT_TEXT);
        String replyText = input.getString(INPUT_REPLY_TEXT);
        int notificationId = input.getInt(INPUT_NOTIFICATION_ID, -1);

        if (replyText == null || replyText.isEmpty() || alertId == null || alertId.isEmpty()) {
            Log.w(TAG, "Missing reply text or alertId — dropping");
            return Result.failure();
        }

        int attempt = getRunAttemptCount();
        Log.d(TAG, "doWork attempt=" + attempt + " alertId=" + alertId);

        try {
            int status = postReply(alertId, replyText, draftText);
            Log.d(TAG, "POST response=" + status + " attempt=" + attempt);

            if (status >= 200 && status < 300) {
                postToMain(() -> CoachReplyNotifier.showSent(
                        getApplicationContext(), notificationId, clientName, replyText));
                postToMainDelayed(() -> CoachReplyNotifier.dismiss(
                        getApplicationContext(), notificationId), 2500);
                return Result.success();
            }

            if (status >= 400 && status < 500) {
                // Permanent: invalid alertId, already-sent alert, server
                // rejected the payload. Retrying won't help.
                postToMain(() -> CoachReplyNotifier.showFailed(
                        getApplicationContext(), notificationId, clientName, replyText,
                        alertId, clientId, draftText,
                        "Server rejected (HTTP " + status + ")"));
                return Result.failure();
            }

            // 5xx — transient server error, retry.
            return retryOrSurfaceFailure(attempt, notificationId, clientName, replyText,
                    alertId, clientId, draftText,
                    "Server error (HTTP " + status + ")");
        } catch (UnknownHostException e) {
            Log.w(TAG, "DNS failure attempt=" + attempt + ": " + e);
            return retryOrSurfaceFailure(attempt, notificationId, clientName, replyText,
                    alertId, clientId, draftText, "No internet connection");
        } catch (SocketTimeoutException e) {
            Log.w(TAG, "Timeout attempt=" + attempt + ": " + e);
            return retryOrSurfaceFailure(attempt, notificationId, clientName, replyText,
                    alertId, clientId, draftText, "No internet connection");
        } catch (IOException e) {
            Log.e(TAG, "postReply failed attempt=" + attempt, e);
            String msg = e.getMessage();
            return retryOrSurfaceFailure(attempt, notificationId, clientName, replyText,
                    alertId, clientId, draftText,
                    (msg == null || msg.isEmpty()) ? "Network error" : msg);
        }
    }

    private Result retryOrSurfaceFailure(int attempt, int notificationId, String clientName,
                                         String replyText, String alertId, String clientId,
                                         String draftText, String friendlyError) {
        if (attempt >= MAX_ATTEMPTS - 1) {
            postToMain(() -> CoachReplyNotifier.showFailed(
                    getApplicationContext(), notificationId, clientName, replyText,
                    alertId, clientId, draftText, friendlyError));
            return Result.failure();
        }
        return Result.retry();
    }

    private int postReply(String alertId, String replyText, String draftText) throws IOException {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(REPLY_ENDPOINT);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(15000);

            JSONObject payload = new JSONObject();
            try {
                payload.put("alertId", alertId);
                payload.put("replyText", replyText);
                payload.put("draftText", draftText == null ? "" : draftText);
                payload.put("source", "android_inline_reply_worker");
            } catch (Exception e) {
                throw new IOException("Failed to build JSON payload: " + e.getMessage());
            }

            byte[] body = payload.toString().getBytes("UTF-8");
            conn.setFixedLengthStreamingMode(body.length);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body);
            }
            return conn.getResponseCode();
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static void postToMain(Runnable r) {
        new Handler(Looper.getMainLooper()).post(r);
    }

    private static void postToMainDelayed(Runnable r, long delayMs) {
        new Handler(Looper.getMainLooper()).postDelayed(r, delayMs);
    }
}
