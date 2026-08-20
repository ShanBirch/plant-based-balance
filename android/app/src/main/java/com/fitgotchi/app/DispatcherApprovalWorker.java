package com.fitgotchi.app;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Data;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class DispatcherApprovalWorker extends Worker {
    private static final String TAG = "DispatchApprovalWrk";
    private static final String ENDPOINT =
            "https://plantbased-balance.org/.netlify/functions/approve-ig-dispatch-batch";
    private static final int MAX_ATTEMPTS = 5;

    static final String INPUT_BATCH_ID = "batchId";
    static final String INPUT_BATCH_VERSION = "batchVersion";
    static final String INPUT_RECIPIENT_ID = "recipientId";
    static final String INPUT_APPROVAL_TOKEN = "approvalToken";
    static final String INPUT_NOTIFICATION_ID = "notificationId";

    public DispatcherApprovalWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Data input = getInputData();
        String batchId = input.getString(INPUT_BATCH_ID);
        String batchVersion = input.getString(INPUT_BATCH_VERSION);
        String recipientId = input.getString(INPUT_RECIPIENT_ID);
        String approvalToken = input.getString(INPUT_APPROVAL_TOKEN);
        int notificationId = input.getInt(INPUT_NOTIFICATION_ID, -1);

        if (empty(batchId) || empty(batchVersion) || empty(recipientId)
                || empty(approvalToken) || notificationId < 0) {
            return Result.failure();
        }

        try {
            Response response = postApproval(batchId, batchVersion, recipientId, approvalToken);
            if (response.status >= 200 && response.status < 300 && response.approved) {
                DispatcherApprovalNotifier.showApproved(
                        getApplicationContext(), notificationId, batchId, batchVersion);
                return Result.success();
            }
            if (response.status >= 400 && response.status < 500) {
                DispatcherApprovalNotifier.showRejected(
                        getApplicationContext(), notificationId, batchId, batchVersion,
                        response.status == 409 ? "This batch is no longer current" : "Approval was rejected");
                return Result.failure();
            }
            return retryOrFail(notificationId, batchId, batchVersion);
        } catch (IOException error) {
            Log.w(TAG, "Approval network failure", error);
            return retryOrFail(notificationId, batchId, batchVersion);
        }
    }

    private Result retryOrFail(int notificationId, String batchId, String batchVersion) {
        if (getRunAttemptCount() >= MAX_ATTEMPTS - 1) {
            DispatcherApprovalNotifier.showRejected(
                    getApplicationContext(), notificationId, batchId, batchVersion,
                    "Could not reach Balance. Wait for the next approval notification");
            return Result.failure();
        }
        return Result.retry();
    }

    private Response postApproval(String batchId, String batchVersion,
                                  String recipientId, String approvalToken) throws IOException {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(ENDPOINT).openConnection();
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setDoOutput(true);
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(15000);

            JSONObject payload = new JSONObject();
            try {
                payload.put("batchId", batchId);
                payload.put("batchVersion", Integer.parseInt(batchVersion));
                payload.put("recipientId", recipientId);
                payload.put("approvalToken", approvalToken);
            } catch (Exception error) {
                throw new IOException("Invalid approval payload", error);
            }
            byte[] bytes = payload.toString().getBytes("UTF-8");
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(bytes);
            }

            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 400
                    ? connection.getInputStream() : connection.getErrorStream();
            String body = "";
            if (stream != null) {
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(stream, "UTF-8"))) {
                    StringBuilder builder = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) builder.append(line);
                    body = builder.toString();
                }
            }
            boolean approved = false;
            try { approved = new JSONObject(body).optBoolean("approved", false); }
            catch (Exception ignored) { /* handled by status/result below */ }
            return new Response(status, approved);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static boolean empty(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static class Response {
        final int status;
        final boolean approved;
        Response(int status, boolean approved) {
            this.status = status;
            this.approved = approved;
        }
    }
}
