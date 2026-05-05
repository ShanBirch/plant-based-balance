package com.fitgotchi.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

final class NativeMoodCheckLogger {
    private static final String PREFS_NAME = "mood_check_widget_prefs";

    private NativeMoodCheckLogger() {}

    static Result log(Context context, int mood, int energy, int stress) throws Exception {
        NativeBalanceSession.Session session = NativeBalanceSession.getValid(context);
        String today = today();
        String window = currentWindow();
        Status before = getStatus(session, today);
        if (before.isCompleted(window)) {
            saveWidgetStatus(context, before);
            return new Result(window, false, before.allDone(), 0);
        }

        JSONObject row = new JSONObject();
        row.put("user_id", session.userId);
        row.put("logged_at", nowIsoUtc());
        row.put("log_date", today);
        row.put("mood_score", mood * 2);
        row.put("energy_score", energy * 2);
        row.put("stress_score", stress * 2);
        row.put("context", window);

        request(session, "POST", "/rest/v1/mood_logs", row.toString(), "return=minimal");

        Status after = before.withCompleted(window);
        int xp = 0;
        if (after.allDone() && !xpAwarded(context, today)) {
            xp = awardXp(session);
            markXpAwarded(context, today);
        }
        saveWidgetStatus(context, after);
        MoodCheckWidgetProvider.updateAll(context);
        return new Result(window, true, after.allDone(), xp);
    }

    static Status getStatus(Context context) throws Exception {
        NativeBalanceSession.Session session = NativeBalanceSession.getValid(context);
        Status status = getStatus(session, today());
        saveWidgetStatus(context, status);
        return status;
    }

    static Status loadCachedStatus(Context context) {
        SharedPreferences prefs = prefs(context);
        String today = today();
        String cachedDate = prefs.getString("status_date", "");
        if (!today.equals(cachedDate)) return new Status(today, false, false, false);
        return new Status(
                today,
                prefs.getBoolean("morning_done", false),
                prefs.getBoolean("afternoon_done", false),
                prefs.getBoolean("evening_done", false));
    }

    static String currentWindow() {
        int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        if (hour >= 4 && hour < 12) return "morning";
        if (hour >= 12 && hour < 18) return "afternoon";
        return "evening";
    }

    static String windowLabel(String window) {
        if ("morning".equals(window)) return "Morning";
        if ("afternoon".equals(window)) return "Afternoon";
        return "Evening";
    }

    static String nextWindowLabel(Status status) {
        if (!status.morningDone) return "Morning";
        if (!status.afternoonDone) return "Afternoon";
        if (!status.eveningDone) return "Evening";
        return "Tomorrow";
    }

    private static Status getStatus(NativeBalanceSession.Session session, String today) throws Exception {
        String path = "/rest/v1/mood_logs?select=context&user_id=eq."
                + url(session.userId)
                + "&log_date=eq." + url(today);
        String response = request(session, "GET", path, null, null);
        JSONArray rows = new JSONArray(response == null || response.isEmpty() ? "[]" : response);
        boolean morning = false;
        boolean afternoon = false;
        boolean evening = false;
        for (int i = 0; i < rows.length(); i++) {
            String context = rows.getJSONObject(i).optString("context", "");
            if ("morning".equals(context)) morning = true;
            if ("afternoon".equals(context)) afternoon = true;
            if ("evening".equals(context)) evening = true;
        }
        return new Status(today, morning, afternoon, evening);
    }

    private static int awardXp(NativeBalanceSession.Session session) throws Exception {
        String path = "/rest/v1/user_points?select=lifetime_points&user_id=eq."
                + url(session.userId)
                + "&limit=1";
        String response = request(session, "GET", path, null, null);
        JSONArray rows = new JSONArray(response == null || response.isEmpty() ? "[]" : response);

        if (rows.length() > 0) {
            int current = rows.getJSONObject(0).optInt("lifetime_points", 0);
            JSONObject update = new JSONObject();
            update.put("lifetime_points", current + 1);
            request(session, "PATCH",
                    "/rest/v1/user_points?user_id=eq." + url(session.userId),
                    update.toString(),
                    "return=minimal");
        } else {
            JSONObject insert = new JSONObject();
            insert.put("user_id", session.userId);
            insert.put("lifetime_points", 1);
            insert.put("current_points", 0);
            request(session, "POST", "/rest/v1/user_points", insert.toString(), "return=minimal");
        }
        return 1;
    }

    private static String request(
            NativeBalanceSession.Session session,
            String method,
            String path,
            String body,
            String prefer
    ) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(NativeBalanceSession.SUPABASE_URL + path).openConnection();
        conn.setRequestMethod(method);
        conn.setRequestProperty("Accept", "application/json");
        conn.setRequestProperty("apikey", NativeBalanceSession.SUPABASE_ANON_KEY);
        conn.setRequestProperty("Authorization", "Bearer " + session.accessToken);
        if (prefer != null) conn.setRequestProperty("Prefer", prefer);
        conn.setConnectTimeout(15_000);
        conn.setReadTimeout(25_000);

        if (body != null) {
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bytes);
            }
        }

        int code = conn.getResponseCode();
        String response = readBody(conn, code);
        conn.disconnect();

        if (code < 200 || code >= 300) {
            throw new java.io.IOException("Supabase request failed: HTTP " + code + " " + response);
        }
        return response;
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

    private static String url(String value) throws Exception {
        return URLEncoder.encode(value, "UTF-8");
    }

    private static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private static String nowIsoUtc() {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        return fmt.format(new Date());
    }

    private static void saveWidgetStatus(Context context, Status status) {
        prefs(context).edit()
                .putString("status_date", status.date)
                .putBoolean("morning_done", status.morningDone)
                .putBoolean("afternoon_done", status.afternoonDone)
                .putBoolean("evening_done", status.eveningDone)
                .putLong("updated_at", System.currentTimeMillis())
                .apply();
    }

    private static boolean xpAwarded(Context context, String date) {
        return prefs(context).getBoolean("xp_awarded_" + date, false);
    }

    private static void markXpAwarded(Context context, String date) {
        prefs(context).edit().putBoolean("xp_awarded_" + date, true).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    static final class Result {
        final String window;
        final boolean inserted;
        final boolean allDone;
        final int xpAwarded;

        Result(String window, boolean inserted, boolean allDone, int xpAwarded) {
            this.window = window;
            this.inserted = inserted;
            this.allDone = allDone;
            this.xpAwarded = xpAwarded;
        }
    }

    static final class Status {
        final String date;
        final boolean morningDone;
        final boolean afternoonDone;
        final boolean eveningDone;

        Status(String date, boolean morningDone, boolean afternoonDone, boolean eveningDone) {
            this.date = date;
            this.morningDone = morningDone;
            this.afternoonDone = afternoonDone;
            this.eveningDone = eveningDone;
        }

        boolean allDone() {
            return morningDone && afternoonDone && eveningDone;
        }

        boolean isCompleted(String window) {
            if ("morning".equals(window)) return morningDone;
            if ("afternoon".equals(window)) return afternoonDone;
            if ("evening".equals(window)) return eveningDone;
            return false;
        }

        Status withCompleted(String window) {
            return new Status(
                    date,
                    morningDone || "morning".equals(window),
                    afternoonDone || "afternoon".equals(window),
                    eveningDone || "evening".equals(window));
        }
    }
}
