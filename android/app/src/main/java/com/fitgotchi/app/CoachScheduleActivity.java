package com.fitgotchi.app;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Bottom-sheet–style picker shown when Shannon taps "Later" on a
 * coach_draft_ready notification. Lets him optionally edit the AI draft and
 * pick how far out to schedule the send (5/15/30/60/120 min). On success,
 * dismisses the notification and finishes.
 *
 * Why an Activity (not just a BroadcastReceiver): we need a UI surface to
 * pick the delay AND optionally edit the draft. CoachReplyReceiver handles
 * the "send now" / "edit + send now" flows where the notification's
 * RemoteInput already captured the input — for "send later" we need the user
 * to interact with the time picker in-app.
 *
 * Why programmatic UI (no XML layout): keeps the Android side lightweight —
 * no new layout / strings / drawables shipped with this feature, mirrors the
 * approach QuickMealActivity already uses.
 *
 * Auth + send: POSTs to /.netlify/functions/schedule-coach-reply with the
 * coach_alert UUID as the capability token. Same trust model as
 * CoachReplyReceiver / send-coach-reply — no JWT on device.
 *
 * Manifest registration: see AndroidManifest.xml entry next to QuickMealActivity.
 */
public class CoachScheduleActivity extends Activity {

    private static final String TAG = "CoachScheduleAct";

    public static final String ACTION_SCHEDULE_REPLY =
            "com.fitgotchi.app.ACTION_SCHEDULE_COACH_REPLY";

    private static final String SCHEDULE_ENDPOINT =
            "https://plantbased-balance.org/.netlify/functions/schedule-coach-reply";

    private static final ExecutorService NET_EXECUTOR = Executors.newSingleThreadExecutor();

    /** Time presets — label + delay in milliseconds. Order = display order. */
    private static final long MIN = 60L * 1000L;
    private static final long[] PRESET_DELAYS_MS = new long[]{
            5 * MIN,
            15 * MIN,
            30 * MIN,
            60 * MIN,
            120 * MIN,
    };
    private static final String[] PRESET_LABELS = new String[]{
            "5 min", "15 min", "30 min", "1 hr", "2 hr",
    };

    private String alertId;
    private String clientName;
    private String originalDraft;
    private int notificationId;
    private EditText replyEdit;
    private LinearLayout chipRow;
    private TextView statusText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Intent intent = getIntent();
        alertId = stringExtra(intent, CoachDraftMessagingService.EXTRA_ALERT_ID);
        clientName = stringExtra(intent, CoachDraftMessagingService.EXTRA_CLIENT_NAME);
        originalDraft = stringExtra(intent, CoachDraftMessagingService.EXTRA_DRAFT_TEXT);
        notificationId = intent.getIntExtra(CoachDraftMessagingService.EXTRA_NOTIFICATION_ID, -1);

        if (alertId.isEmpty() || originalDraft.isEmpty()) {
            Log.w(TAG, "Missing alertId or draftText — closing");
            Toast.makeText(this, "Schedule unavailable", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        setContentView(buildLayout());
    }

    private View buildLayout() {
        // Outer overlay — dim background, dismiss on tap-outside.
        FrameOverlay outer = new FrameOverlay(this);
        outer.setBackgroundColor(0xCC000000);
        outer.setOnClickListener(v -> finish());

        // Card container.
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setOnClickListener(v -> { /* swallow */ });

        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(0xFF1F2937); // slate-800
        cardBg.setCornerRadius(dp(20));
        card.setBackground(cardBg);

        int pad = dp(20);
        card.setPadding(pad, pad, pad, pad);

        FrameOverlay.LayoutParams cardLp = new FrameOverlay.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        cardLp.gravity = Gravity.BOTTOM;
        int outerMargin = dp(12);
        cardLp.leftMargin = outerMargin;
        cardLp.rightMargin = outerMargin;
        cardLp.bottomMargin = outerMargin;
        card.setLayoutParams(cardLp);

        // Title.
        TextView title = new TextView(this);
        title.setText("Send later" + (clientName.isEmpty() ? "" : " — " + clientName));
        title.setTextColor(Color.WHITE);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        card.addView(title);

        // Subtitle.
        TextView subtitle = new TextView(this);
        subtitle.setText("Edit the draft if you want, then choose when to send.");
        subtitle.setTextColor(0xFF9CA3AF); // slate-400
        subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        LinearLayout.LayoutParams subLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        subLp.topMargin = dp(4);
        subLp.bottomMargin = dp(12);
        subtitle.setLayoutParams(subLp);
        card.addView(subtitle);

        // Reply EditText — pre-filled with the AI draft, editable.
        replyEdit = new EditText(this);
        replyEdit.setText(originalDraft);
        replyEdit.setTextColor(Color.WHITE);
        replyEdit.setHintTextColor(0xFF6B7280);
        replyEdit.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        replyEdit.setInputType(InputType.TYPE_CLASS_TEXT
                | InputType.TYPE_TEXT_FLAG_MULTI_LINE
                | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        replyEdit.setMinLines(3);
        replyEdit.setMaxLines(8);
        replyEdit.setVerticalScrollBarEnabled(true);

        GradientDrawable editBg = new GradientDrawable();
        editBg.setColor(0xFF111827); // slate-900
        editBg.setCornerRadius(dp(12));
        editBg.setStroke(dp(1), 0xFF374151); // slate-700
        replyEdit.setBackground(editBg);
        int editPad = dp(12);
        replyEdit.setPadding(editPad, editPad, editPad, editPad);

        ScrollView editScroll = new ScrollView(this);
        editScroll.addView(replyEdit, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        LinearLayout.LayoutParams editLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        editLp.bottomMargin = dp(16);
        editScroll.setLayoutParams(editLp);
        card.addView(editScroll);

        // Chip row — 5 time presets. Two rows on narrow screens; LinearLayout
        // with weight=1 makes them share space evenly.
        chipRow = new LinearLayout(this);
        chipRow.setOrientation(LinearLayout.HORIZONTAL);
        for (int i = 0; i < PRESET_DELAYS_MS.length; i++) {
            final long delayMs = PRESET_DELAYS_MS[i];
            final String label = PRESET_LABELS[i];

            Button chip = new Button(this);
            chip.setText(label);
            chip.setAllCaps(false);
            chip.setTextColor(Color.WHITE);
            chip.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);

            GradientDrawable chipBg = new GradientDrawable();
            chipBg.setColor(0xFF16A34A); // emerald-600
            chipBg.setCornerRadius(dp(10));
            chip.setBackground(chipBg);

            int chipPadV = dp(10);
            int chipPadH = dp(0);
            chip.setPadding(chipPadH, chipPadV, chipPadH, chipPadV);
            chip.setMinHeight(dp(40));
            chip.setMinWidth(0);
            chip.setMinimumWidth(0);

            LinearLayout.LayoutParams chipLp = new LinearLayout.LayoutParams(
                    0,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    1f
            );
            int chipMargin = dp(3);
            chipLp.leftMargin = chipMargin;
            chipLp.rightMargin = chipMargin;
            chip.setLayoutParams(chipLp);

            chip.setOnClickListener(v -> onPickDelay(delayMs, label));
            chipRow.addView(chip);
        }
        LinearLayout.LayoutParams chipRowLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        chipRowLp.bottomMargin = dp(8);
        chipRow.setLayoutParams(chipRowLp);
        card.addView(chipRow);

        // Status text — shown while POST is in flight.
        statusText = new TextView(this);
        statusText.setTextColor(0xFF9CA3AF);
        statusText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        statusText.setVisibility(View.GONE);
        LinearLayout.LayoutParams statusLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        statusLp.topMargin = dp(4);
        statusLp.bottomMargin = dp(4);
        statusText.setLayoutParams(statusLp);
        card.addView(statusText);

        // Cancel — close without scheduling.
        Button cancel = new Button(this);
        cancel.setText("Cancel");
        cancel.setAllCaps(false);
        cancel.setTextColor(0xFF9CA3AF);
        cancel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        cancel.setBackgroundColor(Color.TRANSPARENT);
        cancel.setOnClickListener(v -> finish());
        LinearLayout.LayoutParams cancelLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        cancelLp.topMargin = dp(4);
        cancel.setLayoutParams(cancelLp);
        card.addView(cancel);

        outer.addView(card);
        return outer;
    }

    private void onPickDelay(long delayMs, String label) {
        // Disable the picker row to prevent double-clicks while the request
        // is in flight. Server-side is also idempotent (alert.status flips),
        // but stopping the dupes early gives clearer UX.
        setChipsEnabled(false);
        statusText.setVisibility(View.VISIBLE);
        statusText.setText("Scheduling for " + label + "…");

        final String replyText = replyEdit.getText() == null
                ? originalDraft
                : replyEdit.getText().toString();
        final String trimmed = replyText.trim();
        if (trimmed.isEmpty()) {
            Toast.makeText(this, "Reply is empty", Toast.LENGTH_SHORT).show();
            setChipsEnabled(true);
            statusText.setVisibility(View.GONE);
            return;
        }

        NET_EXECUTOR.submit(() -> {
            boolean ok = postSchedule(alertId, trimmed, originalDraft, delayMs);
            new Handler(Looper.getMainLooper()).post(() -> {
                if (ok) {
                    NotificationManager nm =
                            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null && notificationId != -1) {
                        nm.cancel(notificationId);
                    }
                    Toast.makeText(getApplicationContext(),
                            "Scheduled to send in " + label,
                            Toast.LENGTH_SHORT).show();
                    finish();
                } else {
                    statusText.setText("Couldn't schedule. Tap a time to retry.");
                    setChipsEnabled(true);
                }
            });
        });
    }

    private void setChipsEnabled(boolean enabled) {
        if (chipRow == null) return;
        for (int i = 0; i < chipRow.getChildCount(); i++) {
            chipRow.getChildAt(i).setEnabled(enabled);
            chipRow.getChildAt(i).setAlpha(enabled ? 1f : 0.5f);
        }
    }

    private static boolean postSchedule(String alertId, String replyText,
                                        String draftText, long delayMs) {
        HttpURLConnection conn = null;
        try {
            JSONObject payload = new JSONObject();
            payload.put("alertId", alertId);
            payload.put("replyText", replyText);
            payload.put("draftText", draftText);
            payload.put("sendInMs", delayMs);
            payload.put("source", "android_send_later");

            URL url = new URL(SCHEDULE_ENDPOINT);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(7000);
            conn.setReadTimeout(15000);

            byte[] body = payload.toString().getBytes("UTF-8");
            conn.setFixedLengthStreamingMode(body.length);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body);
            }
            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) return true;
            Log.w(TAG, "schedule-coach-reply non-2xx: " + code);
            return false;
        } catch (Exception e) {
            Log.e(TAG, "schedule POST failed: " + e.getMessage(), e);
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private int dp(int v) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(v * density);
    }

    private static String stringExtra(Intent intent, String key) {
        String v = intent.getStringExtra(key);
        return v == null ? "" : v;
    }

    /**
     * Lightweight FrameLayout subclass — just exposes
     * {@link android.widget.FrameLayout.LayoutParams} via the
     * {@code FrameOverlay.LayoutParams} alias used above. Keeps the
     * import surface small (no separate FrameLayout import in callers).
     */
    public static class FrameOverlay extends android.widget.FrameLayout {
        public FrameOverlay(Context context) { super(context); }
        public static class LayoutParams extends android.widget.FrameLayout.LayoutParams {
            public LayoutParams(int width, int height) { super(width, height); }
        }
    }
}
