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

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

/**
 * "Control" panel — opened when Shannon taps Control (formerly "Later") on
 * a coach_draft_ready notification. Replaces the old quick-pick popup with
 * a richer review surface that shows BEFORE he commits to send / schedule
 * / dismiss:
 *
 *   1. The notes the AI is reading from (client_memory or IG-thread memory)
 *   2. The last ~20 messages of conversation history the AI used
 *   3. The editable draft itself
 *   4. Send-later schedule chips (5/15/30/60/120 min)
 *
 * Both context surfaces are fetched async from
 * /.netlify/functions/coach-control-context using the alertId as a cap
 * (same trust model as schedule-coach-reply / send-coach-reply).
 *
 * Why an Activity (not a notification expansion): RemoteViews can't render
 * scrolling history with this structure, and we need a real EditText for
 * draft editing. The activity is themed translucent and bottom-anchored so
 * it reads as a bottom sheet while still using the standard Activity
 * lifecycle (no Material Components dependency).
 *
 * Send-now flow: the underlying notification stays visible while this
 * activity is up, so closing the activity returns Shannon to the
 * notification's Send / Edit actions. Cancel button just dismisses the
 * activity without scheduling.
 */
public class CoachScheduleActivity extends Activity {

    private static final String TAG = "CoachControlAct";

    public static final String ACTION_SCHEDULE_REPLY =
            "com.fitgotchi.app.ACTION_SCHEDULE_COACH_REPLY";

    private static final String SCHEDULE_ENDPOINT =
            "https://plantbased-balance.org/.netlify/functions/schedule-coach-reply";
    private static final String CONTEXT_ENDPOINT =
            "https://plantbased-balance.org/.netlify/functions/coach-control-context";

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
    private EditText reasonEdit;
    private LinearLayout chipRow;
    private LinearLayout notesContainer;
    private LinearLayout historyContainer;
    private LinearLayout notesAccordionBody;
    private LinearLayout historyAccordionBody;
    private TextView notesAccordionChevron;
    private TextView historyAccordionChevron;
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
            Toast.makeText(this, "Control unavailable", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        setContentView(buildLayout());
        fetchControlContext();
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
        cardLp.topMargin = dp(48); // leaves room above so nothing clips on small phones
        card.setLayoutParams(cardLp);

        // Title row: "Control · {client}"
        TextView title = new TextView(this);
        String titleText = "Control"
                + (clientName.isEmpty() ? "" : "  ·  " + clientName);
        title.setText(titleText);
        title.setTextColor(Color.WHITE);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        card.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("What we know, what they sent, your draft, send when.");
        subtitle.setTextColor(0xFF9CA3AF);
        subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        LinearLayout.LayoutParams subLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        subLp.topMargin = dp(4);
        subLp.bottomMargin = dp(12);
        subtitle.setLayoutParams(subLp);
        card.addView(subtitle);

        // Scrollable middle section — notes + history + draft editor.
        // Wrapping the variable-height parts in a ScrollView keeps the
        // bottom action chips reachable on any phone size.
        ScrollView middleScroll = new ScrollView(this);
        LinearLayout middleColumn = new LinearLayout(this);
        middleColumn.setOrientation(LinearLayout.VERTICAL);
        middleScroll.addView(middleColumn);
        LinearLayout.LayoutParams middleLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f  // takes all leftover vertical space within the card's max
        );
        middleLp.bottomMargin = dp(12);
        middleScroll.setLayoutParams(middleLp);
        card.addView(middleScroll);

        // --- Notes accordion -------------------------------------------------
        // Collapsed by default — Shannon only wants context "if I slide up
        // or click on a box". Tap header to toggle the body.
        LinearLayout notesAccordion = buildAccordion(
                "Notes on " + (clientName.isEmpty() ? "client" : clientName),
                /* defaultOpen = */ false,
                /* chevronTagSetter = */ tv -> notesAccordionChevron = tv
        );
        notesContainer = new LinearLayout(this);
        notesContainer.setOrientation(LinearLayout.VERTICAL);
        TextView notesLoading = new TextView(this);
        notesLoading.setText("Loading notes…");
        notesLoading.setTextColor(0xFF9CA3AF);
        notesLoading.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        notesLoading.setPadding(dp(2), dp(4), dp(2), dp(4));
        notesContainer.addView(notesLoading);
        notesAccordionBody = (LinearLayout) notesAccordion.findViewWithTag("body");
        notesAccordionBody.addView(notesContainer);
        LinearLayout.LayoutParams notesLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        notesLp.bottomMargin = dp(8);
        notesAccordion.setLayoutParams(notesLp);
        middleColumn.addView(notesAccordion);

        // --- Recent messages accordion --------------------------------------
        LinearLayout historyAccordion = buildAccordion(
                "Recent messages (last ~20)",
                /* defaultOpen = */ false,
                /* chevronTagSetter = */ tv -> historyAccordionChevron = tv
        );
        historyContainer = new LinearLayout(this);
        historyContainer.setOrientation(LinearLayout.VERTICAL);
        TextView historyLoading = new TextView(this);
        historyLoading.setText("Loading history…");
        historyLoading.setTextColor(0xFF9CA3AF);
        historyLoading.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        historyLoading.setPadding(dp(2), dp(4), dp(2), dp(4));
        historyContainer.addView(historyLoading);
        historyAccordionBody = (LinearLayout) historyAccordion.findViewWithTag("body");
        historyAccordionBody.addView(historyContainer);
        LinearLayout.LayoutParams histLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        histLp.bottomMargin = dp(12);
        historyAccordion.setLayoutParams(histLp);
        middleColumn.addView(historyAccordion);

        // --- Reply editor ---------------------------------------------------
        TextView replyHeader = sectionHeader("Your reply");
        middleColumn.addView(replyHeader);

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

        GradientDrawable editBg = new GradientDrawable();
        editBg.setColor(0xFF111827);
        editBg.setCornerRadius(dp(12));
        editBg.setStroke(dp(1), 0xFF374151);
        replyEdit.setBackground(editBg);
        int editPad = dp(12);
        replyEdit.setPadding(editPad, editPad, editPad, editPad);
        LinearLayout.LayoutParams editLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        editLp.bottomMargin = dp(4);
        replyEdit.setLayoutParams(editLp);
        middleColumn.addView(replyEdit);

        // --- Schedule reason input (optional) -------------------------------
        // Captured into alert.data.schedule_reason on a successful schedule.
        // Feeds the voice-match learning loop: over time we can correlate
        // scheduling reasons with which kinds of edits Shannon makes when
        // he comes back to send.
        TextView reasonHeader = sectionHeader("Why send later? (optional)");
        LinearLayout.LayoutParams reasonHeaderLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        reasonHeaderLp.topMargin = dp(8);
        reasonHeader.setLayoutParams(reasonHeaderLp);
        card.addView(reasonHeader);

        reasonEdit = new EditText(this);
        reasonEdit.setHint("e.g. giving her space, want to wait til AEST morning");
        reasonEdit.setTextColor(Color.WHITE);
        reasonEdit.setHintTextColor(0xFF6B7280);
        reasonEdit.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        reasonEdit.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        reasonEdit.setMaxLines(2);
        GradientDrawable reasonBg = new GradientDrawable();
        reasonBg.setColor(0xFF111827);
        reasonBg.setCornerRadius(dp(10));
        reasonBg.setStroke(dp(1), 0xFF374151);
        reasonEdit.setBackground(reasonBg);
        int reasonPad = dp(10);
        reasonEdit.setPadding(reasonPad, reasonPad, reasonPad, reasonPad);
        LinearLayout.LayoutParams reasonLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        reasonLp.bottomMargin = dp(8);
        reasonEdit.setLayoutParams(reasonLp);
        card.addView(reasonEdit);

        // --- Send-later chips (now under "Send later" sub-header) -----------
        TextView chipsHeader = sectionHeader("Send later");
        LinearLayout.LayoutParams chipsHeaderLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        chipsHeaderLp.topMargin = dp(8);
        chipsHeader.setLayoutParams(chipsHeaderLp);
        card.addView(chipsHeader);

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
            chipBg.setColor(0xFF16A34A);
            chipBg.setCornerRadius(dp(10));
            chip.setBackground(chipBg);
            int chipPadV = dp(10);
            chip.setPadding(0, chipPadV, 0, chipPadV);
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

        // --- Status line + Cancel ------------------------------------------
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

    /**
     * Async fetch of the notes + last ~20 messages from
     * /.netlify/functions/coach-control-context, then re-render the two
     * panels on the main thread. Failures degrade silently to a "Couldn't
     * load context" line; the rest of the UI still works.
     */
    private void fetchControlContext() {
        NET_EXECUTOR.submit(() -> {
            HttpURLConnection conn = null;
            try {
                JSONObject payload = new JSONObject();
                payload.put("alertId", alertId);
                byte[] body = payload.toString().getBytes("UTF-8");

                URL url = new URL(CONTEXT_ENDPOINT);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Accept", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(7000);
                conn.setReadTimeout(15000);
                conn.setFixedLengthStreamingMode(body.length);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body);
                }

                int status = conn.getResponseCode();
                if (status < 200 || status >= 300) {
                    new Handler(Looper.getMainLooper()).post(this::renderContextError);
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
                JSONObject notes = root.optJSONObject("notes");
                JSONArray msgs = root.optJSONArray("messages");

                new Handler(Looper.getMainLooper()).post(() -> {
                    renderNotes(notes);
                    renderHistory(msgs);
                });
            } catch (Exception e) {
                Log.e(TAG, "context fetch failed: " + e.getMessage(), e);
                new Handler(Looper.getMainLooper()).post(this::renderContextError);
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    private void renderNotes(JSONObject notes) {
        notesContainer.removeAllViews();
        if (notes == null
                || (!notes.has("goals") && !notes.has("running_notes")
                && !notes.has("personal_context") && !notes.has("communication_style")
                && !notes.has("injuries_limits") && !notes.has("coach_instructions"))) {
            TextView empty = new TextView(this);
            empty.setText("No notes saved on this client yet.");
            empty.setTextColor(0xFF9CA3AF);
            empty.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
            empty.setPadding(dp(2), dp(4), dp(2), dp(4));
            notesContainer.addView(empty);
            return;
        }
        int innerGap = dp(6);
        // Coach instructions first — directives Shannon wrote for the AI
        // win over observed-memory cues.
        addNoteBlock(notesContainer, "Coach instructions for AI",
                notes.optString("coach_instructions", ""), innerGap);
        addNoteBlock(notesContainer, "Goals", notes.optString("goals", ""), innerGap);
        addNoteBlock(notesContainer, "Personal context", notes.optString("personal_context", ""), innerGap);
        addNoteBlock(notesContainer, "Communication style", notes.optString("communication_style", ""), innerGap);
        addNoteBlock(notesContainer, "Injuries / limits", notes.optString("injuries_limits", ""), innerGap);
        addNoteBlock(notesContainer, "Running notes", notes.optString("running_notes", ""), innerGap);
    }

    private void addNoteBlock(LinearLayout parent, String label, String content, int gap) {
        if (content == null || content.trim().isEmpty() || "null".equals(content)) return;
        TextView lab = new TextView(this);
        lab.setText(label.toUpperCase());
        lab.setTextColor(0xFF60A5FA);
        lab.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        lab.setTypeface(Typeface.DEFAULT_BOLD);
        lab.setLetterSpacing(0.05f);
        LinearLayout.LayoutParams labLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        labLp.topMargin = gap;
        lab.setLayoutParams(labLp);
        parent.addView(lab);

        TextView body = new TextView(this);
        body.setText(content.trim());
        body.setTextColor(0xFFE5E7EB);
        body.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        body.setLineSpacing(0, 1.25f);
        LinearLayout.LayoutParams bodyLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        bodyLp.topMargin = dp(2);
        body.setLayoutParams(bodyLp);
        parent.addView(body);
    }

    private void renderHistory(JSONArray msgs) {
        historyContainer.removeAllViews();
        if (msgs == null || msgs.length() == 0) {
            TextView empty = new TextView(this);
            empty.setText("No prior messages.");
            empty.setTextColor(0xFF9CA3AF);
            empty.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
            empty.setPadding(dp(10), dp(8), dp(10), dp(8));
            historyContainer.addView(empty);
            return;
        }
        int sectionPad = dp(8);
        historyContainer.setPadding(sectionPad, sectionPad, sectionPad, sectionPad);
        for (int i = 0; i < msgs.length(); i++) {
            JSONObject m = msgs.optJSONObject(i);
            if (m == null) continue;
            String text = m.optString("text", "").trim();
            if (text.isEmpty()) continue;
            String sender = m.optString("sender", "client");
            boolean isCoach = "coach".equals(sender);

            TextView bubble = new TextView(this);
            String channelHint = m.optString("channel", "");
            String channelTag =
                    "instagram".equals(channelHint) ? " · IG"
                  : "messenger".equals(channelHint) ? " · FB"
                  : "";
            String prefix = (isCoach ? "Shannon" : (clientName.isEmpty() ? "Client" : clientName))
                    + channelTag + ":  ";
            bubble.setText(prefix + text);
            bubble.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
            bubble.setTextColor(isCoach ? 0xFFE5E7EB : 0xFFCBD5E1);
            bubble.setLineSpacing(0, 1.2f);
            GradientDrawable bg = new GradientDrawable();
            bg.setColor(isCoach ? 0xFF111827 : 0xFF1E293B);
            bg.setCornerRadius(dp(8));
            bg.setStroke(dp(1), isCoach ? 0xFF16A34A : 0xFF475569);
            bubble.setBackground(bg);
            int bubblePad = dp(8);
            bubble.setPadding(bubblePad, bubblePad, bubblePad, bubblePad);
            LinearLayout.LayoutParams bubbleLp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
            );
            bubbleLp.topMargin = i == 0 ? 0 : dp(4);
            bubble.setLayoutParams(bubbleLp);
            historyContainer.addView(bubble);
        }
    }

    private void renderContextError() {
        notesContainer.removeAllViews();
        TextView err = new TextView(this);
        err.setText("Couldn't load context. Tap Cancel and re-open if you need it.");
        err.setTextColor(0xFFFBBF24);
        err.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        err.setPadding(dp(10), dp(8), dp(10), dp(8));
        notesContainer.addView(err);

        historyContainer.removeAllViews();
    }

    private TextView sectionHeader(String text) {
        TextView t = new TextView(this);
        t.setText(text);
        t.setTextColor(0xFF93C5FD);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setLetterSpacing(0.06f);
        t.setAllCaps(true);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        lp.bottomMargin = dp(4);
        t.setLayoutParams(lp);
        return t;
    }

    private void applyPanelBackground(View v) {
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xFF111827);
        bg.setCornerRadius(dp(12));
        bg.setStroke(dp(1), 0xFF374151);
        v.setBackground(bg);
    }

    /**
     * Click-to-expand accordion. The returned LinearLayout has two children:
     * a header row (always visible) and a body container (initially hidden
     * unless defaultOpen). The body is tagged "body" so callers can find it
     * and add their own content via findViewWithTag("body"). Tapping the
     * header toggles body visibility and rotates the chevron.
     */
    private LinearLayout buildAccordion(String label, boolean defaultOpen,
                                        Consumer<TextView> chevronTagSetter) {
        LinearLayout accordion = new LinearLayout(this);
        accordion.setOrientation(LinearLayout.VERTICAL);
        applyPanelBackground(accordion);

        LinearLayout headerRow = new LinearLayout(this);
        headerRow.setOrientation(LinearLayout.HORIZONTAL);
        headerRow.setGravity(android.view.Gravity.CENTER_VERTICAL);
        int headerPadH = dp(11);
        int headerPadV = dp(9);
        headerRow.setPadding(headerPadH, headerPadV, headerPadH, headerPadV);
        headerRow.setClickable(true);
        headerRow.setFocusable(true);
        headerRow.setBackground(getResources().getDrawable(
                android.R.drawable.list_selector_background));

        TextView chevron = new TextView(this);
        chevron.setText("▸");
        chevron.setTextColor(0xFF93C5FD);
        chevron.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        LinearLayout.LayoutParams chevLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        chevLp.rightMargin = dp(8);
        chevron.setLayoutParams(chevLp);
        if (chevronTagSetter != null) chevronTagSetter.accept(chevron);
        headerRow.addView(chevron);

        TextView labelTv = new TextView(this);
        labelTv.setText(label);
        labelTv.setTextColor(0xFFE5E7EB);
        labelTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        labelTv.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams lblLp = new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        labelTv.setLayoutParams(lblLp);
        headerRow.addView(labelTv);

        accordion.addView(headerRow);

        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setTag("body");
        int bodyPadH = dp(11);
        body.setPadding(bodyPadH, dp(2), bodyPadH, dp(11));
        body.setVisibility(defaultOpen ? View.VISIBLE : View.GONE);
        accordion.addView(body);

        if (defaultOpen) chevron.setRotation(90f);
        headerRow.setOnClickListener(v -> {
            boolean nowOpen = body.getVisibility() != View.VISIBLE;
            body.setVisibility(nowOpen ? View.VISIBLE : View.GONE);
            chevron.animate().rotation(nowOpen ? 90f : 0f).setDuration(150).start();
        });

        return accordion;
    }

    private void onPickDelay(long delayMs, String label) {
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
        final String reasonRaw = reasonEdit != null && reasonEdit.getText() != null
                ? reasonEdit.getText().toString().trim()
                : "";
        final String scheduleReason = reasonRaw.length() > 240
                ? reasonRaw.substring(0, 240)
                : reasonRaw;

        NET_EXECUTOR.submit(() -> {
            boolean ok = postSchedule(alertId, trimmed, originalDraft, delayMs, scheduleReason);
            new Handler(Looper.getMainLooper()).post(() -> {
                if (ok) {
                    NotificationManager nm =
                            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null && notificationId != -1) {
                        nm.cancel(notificationId);
                    }
                    CoachInboxWidgetProvider.requestRefresh(getApplicationContext());
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
                                        String draftText, long delayMs,
                                        String scheduleReason) {
        HttpURLConnection conn = null;
        try {
            JSONObject payload = new JSONObject();
            payload.put("alertId", alertId);
            payload.put("replyText", replyText);
            payload.put("draftText", draftText);
            payload.put("sendInMs", delayMs);
            payload.put("source", "android_send_later");
            if (scheduleReason != null && !scheduleReason.isEmpty()) {
                payload.put("scheduleReason", scheduleReason);
            }

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
     * Lightweight FrameLayout subclass — keeps a stable LayoutParams
     * subclass alias used by the card layout above.
     */
    public static class FrameOverlay extends android.widget.FrameLayout {
        public FrameOverlay(Context context) { super(context); }
        public static class LayoutParams extends android.widget.FrameLayout.LayoutParams {
            public LayoutParams(int width, int height) { super(width, height); }
        }
    }
}
