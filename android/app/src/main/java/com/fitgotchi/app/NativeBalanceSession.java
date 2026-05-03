package com.fitgotchi.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class NativeBalanceSession {
    static final String SUPABASE_URL = "https://hzapaorxqboevxnumxkv.supabase.co";
    static final String SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6YXBhb3J4cWJvZXZ4bnVteGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjA3MTYsImV4cCI6MjA4NDIzNjcxNn0.L8ZuxevbB1pNx2nXtIiiQ-6dZSeqfdGuiEvscljOxq0";

    private static final String PREFS_NAME = "balance_native_session";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_ACCESS_TOKEN = "access_token";
    private static final String KEY_REFRESH_TOKEN = "refresh_token";
    private static final String KEY_EXPIRES_AT_MS = "expires_at_ms";

    private NativeBalanceSession() {}

    static void cache(Context context, String userId, String accessToken, String refreshToken, long expiresAtSeconds) {
        if (context == null || isBlank(userId) || isBlank(accessToken)) return;
        long expiresAtMs = expiresAtSeconds > 0
                ? expiresAtSeconds * 1000L
                : System.currentTimeMillis() + (50L * 60L * 1000L);
        prefs(context).edit()
                .putString(KEY_USER_ID, userId)
                .putString(KEY_ACCESS_TOKEN, accessToken)
                .putString(KEY_REFRESH_TOKEN, refreshToken == null ? "" : refreshToken)
                .putLong(KEY_EXPIRES_AT_MS, expiresAtMs)
                .apply();
    }

    static void clear(Context context) {
        if (context == null) return;
        prefs(context).edit().clear().apply();
    }

    static Session getValid(Context context) throws Exception {
        SharedPreferences prefs = prefs(context);
        String userId = prefs.getString(KEY_USER_ID, null);
        String accessToken = prefs.getString(KEY_ACCESS_TOKEN, null);
        String refreshToken = prefs.getString(KEY_REFRESH_TOKEN, null);
        long expiresAtMs = prefs.getLong(KEY_EXPIRES_AT_MS, 0L);

        if (isBlank(userId) || isBlank(accessToken)) {
            throw new AuthRequiredException();
        }

        long now = System.currentTimeMillis();
        if (expiresAtMs > now + 60_000L) {
            return new Session(userId, accessToken, refreshToken, expiresAtMs);
        }

        if (isBlank(refreshToken)) {
            throw new AuthRequiredException();
        }

        return refresh(context, userId, refreshToken);
    }

    private static Session refresh(Context context, String fallbackUserId, String refreshToken) throws Exception {
        JSONObject body = new JSONObject();
        body.put("refresh_token", refreshToken);

        HttpURLConnection conn = (HttpURLConnection) new URL(
                SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token").openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Accept", "application/json");
        conn.setRequestProperty("apikey", SUPABASE_ANON_KEY);
        conn.setDoOutput(true);
        conn.setConnectTimeout(15_000);
        conn.setReadTimeout(20_000);

        byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
        conn.setFixedLengthStreamingMode(bytes.length);
        try (OutputStream os = conn.getOutputStream()) {
            os.write(bytes);
        }

        int code = conn.getResponseCode();
        String response = readBody(conn, code);
        conn.disconnect();
        if (code < 200 || code >= 300) {
            clear(context);
            throw new AuthRequiredException();
        }

        JSONObject json = new JSONObject(response);
        String accessToken = json.optString("access_token", "");
        String newRefreshToken = json.optString("refresh_token", refreshToken);
        long expiresIn = json.optLong("expires_in", 3600L);
        String userId = fallbackUserId;
        JSONObject user = json.optJSONObject("user");
        if (user != null && !isBlank(user.optString("id", ""))) {
            userId = user.optString("id", fallbackUserId);
        }
        if (isBlank(accessToken) || isBlank(userId)) throw new AuthRequiredException();

        long expiresAtMs = System.currentTimeMillis() + (expiresIn * 1000L);
        cache(context, userId, accessToken, newRefreshToken, expiresAtMs / 1000L);
        return new Session(userId, accessToken, newRefreshToken, expiresAtMs);
    }

    private static String readBody(HttpURLConnection conn, int code) throws Exception {
        InputStream is = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
        if (is == null) return "";
        BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) sb.append(line);
        reader.close();
        return sb.toString();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    static final class Session {
        final String userId;
        final String accessToken;
        final String refreshToken;
        final long expiresAtMs;

        Session(String userId, String accessToken, String refreshToken, long expiresAtMs) {
            this.userId = userId;
            this.accessToken = accessToken;
            this.refreshToken = refreshToken;
            this.expiresAtMs = expiresAtMs;
        }
    }

    static final class AuthRequiredException extends Exception {}
}
