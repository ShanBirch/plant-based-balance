package com.fitgotchi.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Data;
import androidx.work.ForegroundInfo;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Streams a gallery-backed custom exercise video directly from private app
 * storage to B2. WorkManager keeps this alive when the WebView is paused or
 * the user switches apps; no video bytes pass through JavaScript.
 */
public class ExerciseVideoUploadWorker extends Worker {
    static final String INPUT_PAYLOAD = "payload";
    static final String STATUS_PREFS = "exercise_video_upload_status";
    private static final String TAG = "ExerciseVideoUpload";
    private static final String CHANNEL_ID = "exercise_video_uploads";
    private static final int NOTIFICATION_ID = 74021;
    private static final String SITE_URL = "https://plantbased-balance.org";

    public ExerciseVideoUploadWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    static String statusKey(String exerciseId) {
        return "exercise_video_" + exerciseId.replaceAll("[^A-Za-z0-9_-]", "");
    }

    @NonNull
    @Override
    public Result doWork() {
        String rawPayload = getInputData().getString(INPUT_PAYLOAD);
        JSONObject payload;
        try {
            payload = new JSONObject(rawPayload == null ? "{}" : rawPayload);
        } catch (Exception error) {
            return Result.failure();
        }

        String exerciseId = payload.optString("exerciseId", "");
        String sourcePath = payload.optString("sourcePath", "");
        String accessToken = payload.optString("accessToken", "");
        String userId = payload.optString("userId", "");
        String fileName = payload.optString("fileName", "exercise-video.mp4");
        String contentType = payload.optString("contentType", "video/mp4");
        File source = new File(sourcePath);

        if (exerciseId.isEmpty() || accessToken.isEmpty() || userId.isEmpty() || !source.isFile() || source.length() <= 0) {
            writeStatus(exerciseId, "failed", 0, "The selected video is no longer available.", null, null);
            return Result.failure();
        }

        try {
            setForegroundAsync(createForegroundInfo()).get();
            writeStatus(exerciseId, "preparing", 0, null, null, null);
            JSONObject target = requestUploadTarget(accessToken, userId, exerciseId, fileName, contentType, source.length());
            uploadToB2(target, source, contentType, exerciseId);
            writeStatus(exerciseId, "saving", 100, null,
                    target.optString("publicUrl", ""), target.optString("fileName", ""));
            finalizeExercise(accessToken, userId, exerciseId, target);
            submitReview(accessToken, exerciseId, payload.optJSONObject("technique"));
            writeStatus(exerciseId, "uploaded", 100, null,
                    target.optString("publicUrl", ""), target.optString("fileName", ""));
            if (!source.delete()) Log.w(TAG, "Could not delete uploaded source file");
            return Result.success();
        } catch (HttpStatusException error) {
            Log.w(TAG, "HTTP " + error.status + " for " + exerciseId);
            if (error.status >= 400 && error.status < 500) {
                writeStatus(exerciseId, "failed", 0, error.getMessage(), null, null);
                return Result.failure();
            }
            writeStatus(exerciseId, "retrying", 0, "Waiting for a connection…", null, null);
            return Result.retry();
        } catch (IOException error) {
            Log.w(TAG, "Upload network failure", error);
            writeStatus(exerciseId, "retrying", 0, "Waiting for a connection…", null, null);
            return Result.retry();
        } catch (Exception error) {
            Log.e(TAG, "Upload failed", error);
            writeStatus(exerciseId, "failed", 0, "Video upload failed. Tap Retry video.", null, null);
            return Result.failure();
        }
    }

    private JSONObject requestUploadTarget(String token, String userId, String exerciseId,
                                           String fileName, String contentType, long size) throws Exception {
        JSONObject body = new JSONObject();
        body.put("userId", userId);
        body.put("exerciseId", exerciseId);
        body.put("fileName", fileName);
        body.put("contentType", contentType);
        body.put("size", size);
        HttpURLConnection connection = openPost(SITE_URL + "/api/create-exercise-video-upload", token, "application/json");
        try {
            writeBody(connection, body.toString().getBytes(StandardCharsets.UTF_8));
            int status = connection.getResponseCode();
            String response = readResponse(connection, status);
            if (status < 200 || status >= 300) throw new HttpStatusException(status, response);
            JSONObject target = new JSONObject(response);
            if (target.optString("uploadUrl").isEmpty() || target.optString("authorizationToken").isEmpty()) {
                throw new IOException("Upload target was incomplete");
            }
            return target;
        } finally {
            connection.disconnect();
        }
    }

    private void uploadToB2(JSONObject target, File source, String contentType, String exerciseId) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(target.getString("uploadUrl")).openConnection();
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(30000);
        connection.setFixedLengthStreamingMode(source.length());
        connection.setRequestProperty("Authorization", target.getString("authorizationToken"));
        connection.setRequestProperty("X-Bz-File-Name", encodeB2FileName(target.getString("fileName")));
        connection.setRequestProperty("Content-Type", contentType);
        connection.setRequestProperty("X-Bz-Content-Sha1", "do_not_verify");
        long written = 0;
        int lastProgress = -1;
        try (InputStream input = new FileInputStream(source); OutputStream output = connection.getOutputStream()) {
            byte[] buffer = new byte[128 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) {
                output.write(buffer, 0, count);
                written += count;
                int progress = Math.min(99, (int) ((written * 100L) / source.length()));
                if (progress != lastProgress) {
                    writeStatus(exerciseId, "uploading", progress, null, null, null);
                    lastProgress = progress;
                }
            }
        }
        int status = connection.getResponseCode();
        String response = readResponse(connection, status);
        connection.disconnect();
        if (status < 200 || status >= 300) throw new HttpStatusException(status, response);
    }

    private void finalizeExercise(String token, String userId, String exerciseId, JSONObject target) throws Exception {
        JSONObject body = new JSONObject();
        body.put("userId", userId);
        body.put("exerciseId", exerciseId);
        body.put("videoUrl", target.optString("publicUrl", ""));
        body.put("storagePath", target.optString("fileName", ""));
        postExpectSuccess(SITE_URL + "/api/finalize-exercise-video-upload", token, body);
    }

    private void submitReview(String token, String exerciseId, JSONObject technique) throws Exception {
        JSONObject body = new JSONObject();
        body.put("action", "submit");
        body.put("exerciseId", exerciseId);
        body.put("technique", technique == null ? new JSONObject() : technique);
        postExpectSuccess(SITE_URL + "/api/custom-exercise-review", token, body);
    }

    private void postExpectSuccess(String endpoint, String token, JSONObject body) throws Exception {
        HttpURLConnection connection = openPost(endpoint, token, "application/json");
        try {
            writeBody(connection, body.toString().getBytes(StandardCharsets.UTF_8));
            int status = connection.getResponseCode();
            String response = readResponse(connection, status);
            if (status < 200 || status >= 300) throw new HttpStatusException(status, response);
        } finally {
            connection.disconnect();
        }
    }

    private HttpURLConnection openPost(String endpoint, String token, String contentType) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(30000);
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Content-Type", contentType);
        return connection;
    }

    private static void writeBody(HttpURLConnection connection, byte[] body) throws IOException {
        connection.setFixedLengthStreamingMode(body.length);
        try (OutputStream output = connection.getOutputStream()) { output.write(body); }
    }

    private static String readResponse(HttpURLConnection connection, int status) throws IOException {
        InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        if (stream == null) return "";
        try (InputStream input = stream) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private static String encodeB2FileName(String value) throws Exception {
        return URLEncoder.encode(value, "UTF-8").replace("+", "%20").replace("%2F", "/");
    }

    private void writeStatus(String exerciseId, String status, int progress, String error,
                             String publicUrl, String storagePath) {
        if (exerciseId == null || exerciseId.isEmpty()) return;
        try {
            JSONObject data = new JSONObject();
            data.put("status", status);
            data.put("progress", progress);
            if (error != null) data.put("error", error);
            if (publicUrl != null) data.put("publicUrl", publicUrl);
            if (storagePath != null) data.put("storagePath", storagePath);
            SharedPreferences prefs = getApplicationContext().getSharedPreferences(STATUS_PREFS, Context.MODE_PRIVATE);
            prefs.edit().putString(statusKey(exerciseId), data.toString()).apply();
        } catch (Exception ignored) {}
    }

    private ForegroundInfo createForegroundInfo() {
        NotificationManager manager = (NotificationManager) getApplicationContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager != null) {
            manager.createNotificationChannel(new NotificationChannel(CHANNEL_ID, "Video uploads", NotificationManager.IMPORTANCE_LOW));
        }
        NotificationCompat.Builder builder = new NotificationCompat.Builder(getApplicationContext(), CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_upload)
                .setContentTitle("Uploading exercise video")
                .setContentText("Balance will keep uploading in the background.")
                .setOngoing(true)
                .setOnlyAlertOnce(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return new ForegroundInfo(
                    NOTIFICATION_ID,
                    builder.build(),
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        }
        return new ForegroundInfo(NOTIFICATION_ID, builder.build());
    }

    private static class HttpStatusException extends IOException {
        final int status;
        HttpStatusException(int status, String message) {
            super(message == null || message.isEmpty() ? "Server returned HTTP " + status : message);
            this.status = status;
        }
    }
}
