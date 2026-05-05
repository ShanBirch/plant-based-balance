package com.fitgotchi.app;

import android.content.Context;

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
import java.util.Date;
import java.util.Locale;

final class NativeWeighInLogger {
    private NativeWeighInLogger() {}

    static Result log(Context context, double weightKg) throws Exception {
        NativeBalanceSession.Session session = NativeBalanceSession.getValid(context);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        Status before = getStatus(session, today);

        JSONObject weighIn = new JSONObject();
        weighIn.put("user_id", session.userId);
        weighIn.put("weigh_in_date", today);
        weighIn.put("weight_kg", round1(weightKg));
        weighIn.put("notes", JSONObject.NULL);

        request(session, "POST",
                "/rest/v1/daily_weigh_ins?on_conflict=user_id,weigh_in_date",
                weighIn.toString(),
                "resolution=merge-duplicates,return=representation");

        int xp = before.loggedToday ? 0 : awardXp(session);
        updateUserWeight(session, weightKg);
        saveWidgetStatus(context, new Status(true, round1(weightKg), round1(weightKg), today));
        DailyWeighInWidgetProvider.updateAll(context);

        return new Result(round1(weightKg), xp);
    }

    static Status getStatus(Context context) throws Exception {
        NativeBalanceSession.Session session = NativeBalanceSession.getValid(context);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        Status status = getStatus(session, today);
        saveWidgetStatus(context, status);
        return status;
    }

    static Status loadCachedStatus(Context context) {
        android.content.SharedPreferences prefs = context.getApplicationContext()
                .getSharedPreferences("daily_weigh_in_widget_prefs", Context.MODE_PRIVATE);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String cachedDate = prefs.getString("status_date", "");
        boolean loggedToday = today.equals(cachedDate) && prefs.getBoolean("logged_today", false);
        double latest = Double.longBitsToDouble(prefs.getLong("latest_weight_bits", Double.doubleToLongBits(80.0)));
        double todayWeight = Double.longBitsToDouble(prefs.getLong("today_weight_bits", Double.doubleToLongBits(latest)));
        return new Status(loggedToday, latest, todayWeight, cachedDate);
    }

    private static Status getStatus(NativeBalanceSession.Session session, String today) throws Exception {
        String path = "/rest/v1/daily_weigh_ins?select=weigh_in_date,weight_kg&user_id=eq."
                + url(session.userId)
                + "&order=weigh_in_date.desc&limit=1";
        String response = request(session, "GET", path, null, null);
        JSONArray rows = new JSONArray(response == null || response.isEmpty() ? "[]" : response);
        if (rows.length() == 0) {
            return new Status(false, 80.0, 80.0, today);
        }

        JSONObject latest = rows.getJSONObject(0);
        String latestDate = latest.optString("weigh_in_date", "");
        double latestWeight = round1(latest.optDouble("weight_kg", 80.0));
        boolean loggedToday = today.equals(latestDate);
        return new Status(loggedToday, latestWeight, loggedToday ? latestWeight : latestWeight, today);
    }

    private static void saveWidgetStatus(Context context, Status status) {
        context.getApplicationContext()
                .getSharedPreferences("daily_weigh_in_widget_prefs", Context.MODE_PRIVATE)
                .edit()
                .putString("status_date", status.date)
                .putBoolean("logged_today", status.loggedToday)
                .putLong("latest_weight_bits", Double.doubleToLongBits(status.latestWeightKg))
                .putLong("today_weight_bits", Double.doubleToLongBits(status.todayWeightKg))
                .putLong("updated_at", System.currentTimeMillis())
                .apply();
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

    private static void updateUserWeight(NativeBalanceSession.Session session, double weightKg) {
        try {
            JSONObject update = new JSONObject();
            update.put("weight", round1(weightKg));
            request(session, "PATCH",
                    "/rest/v1/users?id=eq." + url(session.userId),
                    update.toString(),
                    "return=minimal");
        } catch (Exception ignored) { }
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

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    static final class Result {
        final double weightKg;
        final int xpAwarded;

        Result(double weightKg, int xpAwarded) {
            this.weightKg = weightKg;
            this.xpAwarded = xpAwarded;
        }
    }

    static final class Status {
        final boolean loggedToday;
        final double latestWeightKg;
        final double todayWeightKg;
        final String date;

        Status(boolean loggedToday, double latestWeightKg, double todayWeightKg, String date) {
            this.loggedToday = loggedToday;
            this.latestWeightKg = latestWeightKg;
            this.todayWeightKg = todayWeightKg;
            this.date = date;
        }
    }
}
