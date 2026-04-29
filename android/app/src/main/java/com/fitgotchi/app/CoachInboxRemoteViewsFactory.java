package com.fitgotchi.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

/**
 * Pulls the coach feed from /.netlify/functions/widget-coach-feed and emits
 * one RemoteViews per pending/scheduled draft for the home-screen widget.
 *
 * The factory lives in the app's process. Network is allowed in
 * onDataSetChanged (which the framework calls on a worker thread,
 * specifically for this purpose). We block on the HTTP call there and
 * cache the parsed list in a List<Item>; getViewAt is then a synchronous
 * read against that cache.
 *
 * Auth: the device's FCM token is the cap. We read it from
 * SharedPreferences ("widget_prefs", key "fcm_token") — populated by
 * CoachDraftMessagingService.onNewToken / onMessageReceived. If the token
 * isn't there yet (fresh install before any push has been received) the
 * server returns an empty list with hint=unregistered_token, which the
 * empty view in widget_coach_inbox.xml handles.
 */
public class CoachInboxRemoteViewsFactory implements RemoteViewsService.RemoteViewsFactory {

    private static final String TAG = "CoachInboxFactory";

    private static final String FEED_ENDPOINT =
            "https://plantbased-balance.org/.netlify/functions/widget-coach-feed";

    static final String PREFS_NAME = "widget_prefs";
    static final String PREF_FCM_TOKEN = "fcm_token";

    private final Context context;
    private final List<Item> items = new ArrayList<>();

    static class Item {
        String id;
        String clientName;
        String draftPreview;
        String status;            // "pending" or "scheduled"
        boolean hasDraft;
        String channelLabel;      // "IG" / "FB" / null for in-app
        long scheduledForMs;      // 0 if not scheduled
    }

    public CoachInboxRemoteViewsFactory(Context context, Intent intent) {
        this.context = context;
    }

    @Override public void onCreate() { /* no-op */ }

    @Override
    public void onDataSetChanged() {
        items.clear();

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String fcmToken = prefs.getString(PREF_FCM_TOKEN, "");
        if (TextUtils.isEmpty(fcmToken)) {
            Log.w(TAG, "no fcm_token in widget_prefs — leaving list empty");
            return;
        }

        HttpURLConnection conn = null;
        try {
            JSONObject body = new JSONObject();
            body.put("fcmToken", fcmToken);
            byte[] payload = body.toString().getBytes("UTF-8");

            URL url = new URL(FEED_ENDPOINT);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(7000);
            conn.setReadTimeout(15000);
            conn.setFixedLengthStreamingMode(payload.length);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(payload);
            }

            int status = conn.getResponseCode();
            if (status < 200 || status >= 300) {
                Log.w(TAG, "feed non-2xx: " + status);
                return;
            }

            String responseBody;
            try (InputStream is = conn.getInputStream()) {
                StringBuilder sb = new StringBuilder();
                BufferedReader r = new BufferedReader(new InputStreamReader(is, "UTF-8"));
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
                responseBody = sb.toString();
            }

            JSONObject root = new JSONObject(responseBody);
            JSONArray arr = root.optJSONArray("alerts");
            if (arr == null) return;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null) continue;
                Item it = new Item();
                it.id = o.optString("id", "");
                it.clientName = o.optString("clientName", "Client");
                it.draftPreview = o.optString("draftPreview", "");
                it.status = o.optString("status", "pending");
                it.hasDraft = o.optBoolean("hasDraft", !TextUtils.isEmpty(it.draftPreview));
                String ch = o.optString("channelLabel", "");
                it.channelLabel = TextUtils.isEmpty(ch) || "null".equals(ch) ? null : ch;
                String sched = o.optString("scheduledFor", "");
                it.scheduledForMs = parseIso(sched);
                if (!TextUtils.isEmpty(it.id)) items.add(it);
            }
            Log.d(TAG, "feed loaded: " + items.size() + " item(s)");
        } catch (Exception e) {
            Log.e(TAG, "feed fetch failed: " + e.getMessage(), e);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    @Override
    public void onDestroy() {
        items.clear();
    }

    @Override
    public int getCount() {
        return items.size();
    }

    @Override
    public RemoteViews getViewAt(int position) {
        if (position < 0 || position >= items.size()) return null;
        Item item = items.get(position);
        RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.widget_inbox_item);

        // Client name + optional channel chip.
        if (item.channelLabel != null) {
            row.setTextViewText(R.id.row_client_name, item.clientName + "  ·  " + item.channelLabel);
        } else {
            row.setTextViewText(R.id.row_client_name, item.clientName);
        }

        // Status pill: scheduled gets the amber "fires in X" tag, pending
        // gets a small dot + draft-ready label, no-draft gets a muted label.
        if ("scheduled".equals(item.status) && item.scheduledForMs > 0) {
            row.setViewVisibility(R.id.row_status_pill, android.view.View.VISIBLE);
            row.setTextViewText(R.id.row_status_pill, "⏱ " + relativeFutureLabel(item.scheduledForMs));
            row.setInt(R.id.row_status_pill, "setBackgroundColor", 0xFFFEF3C7); // amber-100
            row.setTextColor(R.id.row_status_pill, 0xFF92400E); // amber-800
        } else if (item.hasDraft) {
            row.setViewVisibility(R.id.row_status_pill, android.view.View.VISIBLE);
            row.setTextViewText(R.id.row_status_pill, "Draft ready");
            row.setInt(R.id.row_status_pill, "setBackgroundColor", 0xFFDCFCE7); // green-100
            row.setTextColor(R.id.row_status_pill, 0xFF166534); // green-800
        } else {
            row.setViewVisibility(R.id.row_status_pill, android.view.View.VISIBLE);
            row.setTextViewText(R.id.row_status_pill, "New message");
            row.setInt(R.id.row_status_pill, "setBackgroundColor", 0xFFE0E7FF); // indigo-100
            row.setTextColor(R.id.row_status_pill, 0xFF3730A3); // indigo-800
        }

        // Draft preview.
        String preview = TextUtils.isEmpty(item.draftPreview)
                ? (item.hasDraft ? "" : "(simple reply — no draft)")
                : item.draftPreview;
        row.setTextViewText(R.id.row_draft_preview, preview);

        // Per-row tap fill-in intent — merged into the template intent set
        // by the provider. The launcher handles the actual launch; we just
        // attach the alertId so MainActivity can deep-link in the future.
        Intent fillIn = new Intent();
        Bundle extras = new Bundle();
        extras.putString("alert_id", item.id);
        fillIn.putExtras(extras);
        row.setOnClickFillInIntent(R.id.row_root, fillIn);

        return row;
    }

    @Override public RemoteViews getLoadingView() { return null; }
    @Override public int getViewTypeCount() { return 1; }
    @Override public long getItemId(int position) {
        if (position < 0 || position >= items.size()) return position;
        // RemoteViews list IDs need to be stable across refreshes so the
        // launcher can preserve scroll position. Hash of UUID is plenty.
        return items.get(position).id.hashCode();
    }
    @Override public boolean hasStableIds() { return true; }

    // --- helpers --------------------------------------------------------

    /** Parse an ISO-8601 timestamp into epoch ms. Returns 0 on any failure. */
    private static long parseIso(String iso) {
        if (TextUtils.isEmpty(iso) || "null".equals(iso)) return 0;
        try {
            // SimpleDateFormat doesn't grok the "Z" suffix without
            // explicit handling; java.time is API 26+. Cheap shim:
            // strip Z, parse as UTC.
            String trimmed = iso.endsWith("Z") ? iso.substring(0, iso.length() - 1) : iso;
            java.text.SimpleDateFormat fmt = new java.text.SimpleDateFormat(
                    "yyyy-MM-dd'T'HH:mm:ss.SSS", java.util.Locale.US);
            fmt.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            // The server may emit fewer than 3 fraction digits; pad if so.
            int dot = trimmed.indexOf('.');
            if (dot < 0) {
                trimmed = trimmed + ".000";
            } else {
                int fracLen = trimmed.length() - dot - 1;
                while (fracLen < 3) { trimmed = trimmed + "0"; fracLen++; }
                if (fracLen > 3) trimmed = trimmed.substring(0, dot + 4);
            }
            return fmt.parse(trimmed).getTime();
        } catch (Exception e) {
            return 0;
        }
    }

    /** "in 12 min" / "in 2 hr" / "any moment" / "due now". */
    private static String relativeFutureLabel(long targetMs) {
        long deltaMs = targetMs - System.currentTimeMillis();
        if (deltaMs <= 0) return "due now";
        if (deltaMs <= 60_000) return "any moment";
        long min = Math.round(deltaMs / 60_000.0);
        if (min < 60) return "in " + min + " min";
        long hr = Math.round(min / 60.0);
        if (hr < 24) return "in " + hr + " hr";
        long days = Math.round(hr / 24.0);
        return "in " + days + (days == 1 ? " day" : " days");
    }
}
