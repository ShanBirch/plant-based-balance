package com.fitgotchi.app;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
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
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
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
import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;
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
 *   4. Send-later schedule dropdown (5/15/30/45 min + 1-24 hr from now,
 *      labelled as wall-clock times like "3:05 PM" or "Tomorrow 12:15 AM")
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
    private static final String DISMISS_ENDPOINT =
            "https://plantbased-balance.org/.netlify/functions/dismiss-coach-reply";

    private static final ExecutorService NET_EXECUTOR = Executors.newSingleThreadExecutor();

    /**
     * Time presets for the Send-later dropdown — delays in milliseconds. The
     * companion human label is built dynamically by formatDelayAsTimeLabel()
     * so Shannon sees the actual clock time each option corresponds to
     * ("3:05 PM", "Tomorrow 12:15 AM") rather than a raw duration.
     *
     * Index 0 is a placeholder ("— Pick a time —"). The listener skips
     * position 0 so the initial layout doesn't accidentally fire a schedule.
     *
     * 5/15/30/45 min give fine control inside the next hour; 1-24 hr cover
     * the rest of the day. Labels are recomputed at click time so a slow
     * pick still shows the actual fire time in the toast.
     */
    private static final long MIN = 60L * 1000L;
    private static final long HR = 60L * MIN;
    private static final long[] PRESET_DELAYS_MS = new long[]{
            0L,        // 0 — placeholder
            5 * MIN,
            15 * MIN,
            30 * MIN,
            45 * MIN,
            1 * HR,
            2 * HR,
            3 * HR,
            4 * HR,
            5 * HR,
            6 * HR,
            7 * HR,
            8 * HR,
            9 * HR,
            10 * HR,
            11 * HR,
            12 * HR,
            13 * HR,
            14 * HR,
            15 * HR,
            16 * HR,
            17 * HR,
            18 * HR,
            19 * HR,
            20 * HR,
            21 * HR,
            22 * HR,
            23 * HR,
            24 * HR,
    };

    private String alertId;
    private String clientName;
    private String originalDraft;
    private int notificationId;
    private EditText replyEdit;
    private EditText reasonEdit;
    private Spinner scheduleSpinner;
    // Built once in buildLayout from the current clock — e.g. "3:05 PM" or
    // "Tomorrow 12:15 AM". Static for the visible spinner items; the listener
    // re-formats at click time so the toast reflects the real fire time.
    private String[] scheduleLabels;
    private LinearLayout notesContainer;
    private LinearLayout historyContainer;
    private LinearLayout notesAccordion;
    private LinearLayout historyAccordion;
    private LinearLayout notesAccordionBody;
    private LinearLayout historyAccordionBody;
    private TextView notesAccordionChevron;
    private TextView historyAccordionChevron;
    // "Why this draft" — answers the first question Shannon asks when he
    // opens Control. Sits above notes/messages and is the only accordion
    // that defaults to OPEN, since reasoning IS the headline content here.
    private LinearLayout reasoningAccordion;
    private LinearLayout reasoningAccordionBody;
    private TextView reasoningAccordionChevron;
    private LinearLayout reasoningContainer;
    private TextView statusText;
    private Button sendNowButton;
    // Voice-match dial in the title row — populated after fetchControlContext.
    private TextView voiceMatchPill;
    // "Why did you change it?" — captured into data.edit_reason on send/schedule
    // when the reply text differs from the original AI draft.
    private EditText editReasonEdit;
    // Inline redraft helper — type a hint, hit Go, AI re-runs the draft.
    private EditText redraftHintEdit;
    private Button redraftGoButton;
    // Inline editor for client_memory.coach_instructions — lives at the top
    // of the Notes accordion so Shannon can teach the AI persistent rules
    // about this client without leaving the activity.
    private EditText coachInstructionsEdit;
    private Button coachInstructionsSaveButton;
    private TextView coachInstructionsStatus;
    // Dismiss/Forget — optional reason input + button, matching the web
    // DMs tab's "Forget" action with reason capture.
    private LinearLayout dismissRow;
    private EditText dismissReasonEdit;
    private Button dismissButton;
    private Button forgetButton;
    // Cached for redraft swap-in + edit-reason "did the user actually edit?"
    private String currentDraftText;

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

        // Track the current canonical draft (replaced on a successful
        // redraft) so onSendNow / onPickDelay can decide whether the user
        // edited it before firing.
        currentDraftText = originalDraft;

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

        // Title row: "Control · {client}" + voice match pill on the right.
        // The pill is empty until fetchControlContext returns; renderVoice
        // Match populates it. Hidden when the client has fewer than 3
        // actioned drafts (returns enoughData=false).
        LinearLayout titleRow = new LinearLayout(this);
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(android.view.Gravity.CENTER_VERTICAL);

        TextView title = new TextView(this);
        String titleText = "Control"
                + (clientName.isEmpty() ? "" : "  ·  " + clientName);
        title.setText(titleText);
        title.setTextColor(Color.WHITE);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        title.setLayoutParams(titleLp);
        titleRow.addView(title);

        voiceMatchPill = new TextView(this);
        voiceMatchPill.setVisibility(View.GONE);
        voiceMatchPill.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        voiceMatchPill.setTypeface(Typeface.DEFAULT_BOLD);
        int vmPadH = dp(8);
        int vmPadV = dp(3);
        voiceMatchPill.setPadding(vmPadH, vmPadV, vmPadH, vmPadV);
        titleRow.addView(voiceMatchPill);

        card.addView(titleRow);

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
        // bottom action UI reachable on any phone size.
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

        // --- Why this draft accordion ---------------------------------------
        // Open by default — this IS the answer to "why am I opening Control
        // Center" most of the time. Hidden entirely when the server returns
        // no reasoning (e.g. simple-reply alerts where no draft was made).
        reasoningAccordion = buildAccordion(
                "Why this draft",
                /* defaultOpen = */ true,
                /* chevronTagSetter = */ tv -> reasoningAccordionChevron = tv
        );
        reasoningContainer = new LinearLayout(this);
        reasoningContainer.setOrientation(LinearLayout.VERTICAL);
        TextView reasoningLoading = new TextView(this);
        reasoningLoading.setText("Loading reasoning…");
        reasoningLoading.setTextColor(0xFF9CA3AF);
        reasoningLoading.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        reasoningLoading.setPadding(dp(2), dp(4), dp(2), dp(4));
        reasoningContainer.addView(reasoningLoading);
        reasoningAccordionBody = (LinearLayout) reasoningAccordion.findViewWithTag("body");
        reasoningAccordionBody.addView(reasoningContainer);
        LinearLayout.LayoutParams reasoningLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        reasoningLp.bottomMargin = dp(8);
        reasoningAccordion.setLayoutParams(reasoningLp);
        // Hidden until fetchControlContext confirms there's something to show.
        reasoningAccordion.setVisibility(View.GONE);
        middleColumn.addView(reasoningAccordion);

        // --- Notes accordion -------------------------------------------------
        // Collapsed by default — Shannon only wants context "if I slide up
        // or click on a box". Tap header to toggle the body. Once the
        // fetch completes, updateAccordionLabel patches in a count suffix
        // so it's clear how much content is hiding inside.
        notesAccordion = buildAccordion(
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
        historyAccordion = buildAccordion(
                "Recent messages",
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

        // --- Redraft helper -------------------------------------------------
        // Inline alternative to manual edits: type a hint, hit Go, the
        // server re-runs the draft and replaces the reply field. Useful
        // when the AI is in the right ballpark but missed a beat — saves
        // the back-and-forth of editing from scratch.
        LinearLayout redraftRow = new LinearLayout(this);
        redraftRow.setOrientation(LinearLayout.HORIZONTAL);
        redraftRow.setGravity(android.view.Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams redraftRowLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        redraftRowLp.topMargin = dp(8);
        redraftRowLp.bottomMargin = dp(8);
        redraftRow.setLayoutParams(redraftRowLp);

        redraftHintEdit = new EditText(this);
        redraftHintEdit.setHint("Redraft hint: warmer, shorter, ask about her trip…");
        redraftHintEdit.setTextColor(0xFF78350F);
        redraftHintEdit.setHintTextColor(0xFFCA8A04);
        redraftHintEdit.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        redraftHintEdit.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        redraftHintEdit.setMaxLines(2);
        GradientDrawable rdBg = new GradientDrawable();
        rdBg.setColor(0xFFFFFBEB);
        rdBg.setCornerRadius(dp(10));
        rdBg.setStroke(dp(1), 0xFFFDE68A);
        redraftHintEdit.setBackground(rdBg);
        int rdPad = dp(10);
        redraftHintEdit.setPadding(rdPad, rdPad, rdPad, rdPad);
        LinearLayout.LayoutParams rdInputLp = new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        rdInputLp.rightMargin = dp(6);
        redraftHintEdit.setLayoutParams(rdInputLp);
        redraftRow.addView(redraftHintEdit);

        redraftGoButton = new Button(this);
        redraftGoButton.setText("Redraft");
        redraftGoButton.setAllCaps(false);
        redraftGoButton.setTextColor(Color.WHITE);
        redraftGoButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        redraftGoButton.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable rdBtnBg = new GradientDrawable();
        rdBtnBg.setColor(0xFFF59E0B);
        rdBtnBg.setCornerRadius(dp(10));
        redraftGoButton.setBackground(rdBtnBg);
        int rdBtnPadH = dp(14);
        int rdBtnPadV = dp(10);
        redraftGoButton.setPadding(rdBtnPadH, rdBtnPadV, rdBtnPadH, rdBtnPadV);
        redraftGoButton.setMinHeight(0);
        redraftGoButton.setMinWidth(0);
        redraftGoButton.setMinimumWidth(0);
        redraftGoButton.setOnClickListener(v -> onRedraft());
        LinearLayout.LayoutParams rdBtnLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        redraftGoButton.setLayoutParams(rdBtnLp);
        redraftRow.addView(redraftGoButton);
        middleColumn.addView(redraftRow);

        // --- Edit reason input (optional) -----------------------------------
        // Captured into alert.data.edit_reason on send/schedule when the
        // reply differs from the original draft. Feeds the voice-match
        // feedback loop with labelled correction signal beyond bare
        // was_edited boolean.
        editReasonEdit = new EditText(this);
        editReasonEdit.setHint("Why did you change it? (optional — helps the AI learn)");
        editReasonEdit.setTextColor(Color.WHITE);
        editReasonEdit.setHintTextColor(0xFF6B7280);
        editReasonEdit.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        editReasonEdit.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        editReasonEdit.setMaxLines(2);
        GradientDrawable erBg = new GradientDrawable();
        erBg.setColor(0xFF111827);
        erBg.setCornerRadius(dp(10));
        erBg.setStroke(dp(1), 0xFF374151);
        editReasonEdit.setBackground(erBg);
        int erPad = dp(10);
        editReasonEdit.setPadding(erPad, erPad, erPad, erPad);
        LinearLayout.LayoutParams erLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        erLp.bottomMargin = dp(8);
        editReasonEdit.setLayoutParams(erLp);
        middleColumn.addView(editReasonEdit);

        // --- Send now (primary CTA) -----------------------------------------
        // The activity used to be schedule-only; you'd cancel back to the
        // notification to fire the draft. Send Now collapses that into one
        // place so the activity is a full review-and-act surface.
        sendNowButton = new Button(this);
        sendNowButton.setText("Send now");
        sendNowButton.setAllCaps(false);
        sendNowButton.setTextColor(Color.WHITE);
        sendNowButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        sendNowButton.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable sendBg = new GradientDrawable();
        sendBg.setColor(0xFF22C55E); // emerald-500 — visually distinct from schedule dropdown
        sendBg.setCornerRadius(dp(10));
        sendNowButton.setBackground(sendBg);
        int sendPadV = dp(12);
        sendNowButton.setPadding(0, sendPadV, 0, sendPadV);
        sendNowButton.setOnClickListener(v -> onSendNow());
        LinearLayout.LayoutParams sendNowLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        sendNowLp.topMargin = dp(4);
        sendNowLp.bottomMargin = dp(10);
        sendNowButton.setLayoutParams(sendNowLp);
        card.addView(sendNowButton);

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

        // --- Send-later dropdown --------------------------------------------
        // Replaces a row of 5 chips with a single Spinner so we can fit more
        // options (incl. Tomorrow 9am) without crowding the row. Item 0 is a
        // "— Pick a time —" placeholder so initial layout doesn't auto-fire.
        TextView chipsHeader = sectionHeader("Send later");
        LinearLayout.LayoutParams chipsHeaderLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        chipsHeaderLp.topMargin = dp(8);
        chipsHeader.setLayoutParams(chipsHeaderLp);
        card.addView(chipsHeader);

        scheduleLabels = buildScheduleLabels();
        scheduleSpinner = new Spinner(this);
        ArrayAdapter<String> scheduleAdapter = new ArrayAdapter<String>(
                this, android.R.layout.simple_spinner_item, scheduleLabels) {
            @Override
            public View getView(int position, View convertView, ViewGroup parent) {
                TextView tv = (TextView) super.getView(position, convertView, parent);
                tv.setTextColor(Color.WHITE);
                tv.setTypeface(Typeface.DEFAULT_BOLD);
                tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
                tv.setPadding(dp(14), dp(12), dp(14), dp(12));
                // Chevron suffix on the closed state — our GradientDrawable
                // background replaces the system dropdown-indicator triangle,
                // so we re-add an affordance manually.
                tv.setText(scheduleLabels[position] + "   ▾");
                return tv;
            }
        };
        scheduleAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        scheduleSpinner.setAdapter(scheduleAdapter);

        GradientDrawable spinnerBg = new GradientDrawable();
        spinnerBg.setColor(0xFF16A34A); // same green as the old chips
        spinnerBg.setCornerRadius(dp(10));
        scheduleSpinner.setBackground(spinnerBg);

        scheduleSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int pos, long id) {
                if (pos <= 0 || pos >= PRESET_DELAYS_MS.length) return; // placeholder
                long delayMs = PRESET_DELAYS_MS[pos];
                // Re-format from current clock so the toast shows the real
                // fire time, not a label that's stale by however long
                // Shannon took to pick.
                String freshLabel = formatDelayAsTimeLabel(delayMs);
                onPickDelay(delayMs, freshLabel);
            }
            @Override
            public void onNothingSelected(AdapterView<?> parent) { }
        });

        LinearLayout.LayoutParams spinnerLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        spinnerLp.bottomMargin = dp(8);
        scheduleSpinner.setLayoutParams(spinnerLp);
        card.addView(scheduleSpinner);

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

        // --- Forget/Dismiss button -----------------------------------------
        // Tap "Forget" → reveals a reason input + confirm button.
        // Mirrors the web DMs tab's promptDismissReason flow so both
        // surfaces capture the same voice-match feedback signal.
        forgetButton = new Button(this);
        forgetButton.setText("Forget this draft");
        forgetButton.setAllCaps(false);
        forgetButton.setTextColor(0xFFEF4444); // red-500
        forgetButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        forgetButton.setBackgroundColor(Color.TRANSPARENT);
        forgetButton.setOnClickListener(v -> toggleDismissRow());
        LinearLayout.LayoutParams forgetLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        forgetLp.topMargin = dp(8);
        forgetButton.setLayoutParams(forgetLp);
        card.addView(forgetButton);

        // Expandable dismiss row — hidden until Forget is tapped.
        dismissRow = new LinearLayout(this);
        dismissRow.setOrientation(LinearLayout.HORIZONTAL);
        dismissRow.setGravity(android.view.Gravity.CENTER_VERTICAL);
        dismissRow.setVisibility(View.GONE);
        LinearLayout.LayoutParams dismissRowLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        dismissRowLp.topMargin = dp(6);
        dismissRow.setLayoutParams(dismissRowLp);

        dismissReasonEdit = new EditText(this);
        dismissReasonEdit.setHint("Why dismiss? (optional)");
        dismissReasonEdit.setTextColor(Color.WHITE);
        dismissReasonEdit.setHintTextColor(0xFF6B7280);
        dismissReasonEdit.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        dismissReasonEdit.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        dismissReasonEdit.setMaxLines(2);
        GradientDrawable drBg = new GradientDrawable();
        drBg.setColor(0xFF111827);
        drBg.setCornerRadius(dp(8));
        drBg.setStroke(dp(1), 0xFFEF4444);
        dismissReasonEdit.setBackground(drBg);
        int drPad = dp(10);
        dismissReasonEdit.setPadding(drPad, drPad, drPad, drPad);
        LinearLayout.LayoutParams drInputLp = new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        drInputLp.rightMargin = dp(6);
        dismissReasonEdit.setLayoutParams(drInputLp);
        dismissRow.addView(dismissReasonEdit);

        dismissButton = new Button(this);
        dismissButton.setText("Dismiss");
        dismissButton.setAllCaps(false);
        dismissButton.setTextColor(Color.WHITE);
        dismissButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        dismissButton.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable dismissBtnBg = new GradientDrawable();
        dismissBtnBg.setColor(0xFFEF4444);
        dismissBtnBg.setCornerRadius(dp(8));
        dismissButton.setBackground(dismissBtnBg);
        int dismissPadH = dp(14);
        int dismissPadV = dp(10);
        dismissButton.setPadding(dismissPadH, dismissPadV, dismissPadH, dismissPadV);
        dismissButton.setMinHeight(0);
        dismissButton.setMinWidth(0);
        dismissButton.setMinimumWidth(0);
        dismissButton.setOnClickListener(v -> onDismiss());
        LinearLayout.LayoutParams dismissBtnLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        dismissButton.setLayoutParams(dismissBtnLp);
        dismissRow.addView(dismissButton);

        card.addView(dismissRow);

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
                JSONObject vm = root.optJSONObject("voiceMatch");
                JSONObject reasoning = root.optJSONObject("reasoning");

                new Handler(Looper.getMainLooper()).post(() -> {
                    renderReasoning(reasoning);
                    renderNotes(notes);
                    renderHistory(msgs);
                    applyVoiceMatch(vm);
                });
            } catch (Exception e) {
                Log.e(TAG, "context fetch failed: " + e.getMessage(), e);
                new Handler(Looper.getMainLooper()).post(this::renderContextError);
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    /**
     * Render the "Why this draft" panel. Hides the entire accordion when no
     * reasoning is present (most non-lead alerts today, until phase 2 wires
     * generic reasoning into every draft producer).
     */
    private void renderReasoning(JSONObject reasoning) {
        if (reasoningContainer == null || reasoningAccordion == null) return;
        reasoningContainer.removeAllViews();
        String text = reasoning != null ? reasoning.optString("text", "").trim() : "";
        if (text.isEmpty() || "null".equals(text)) {
            reasoningAccordion.setVisibility(View.GONE);
            return;
        }
        String source = reasoning.optString("source", "").trim();
        TextView body = new TextView(this);
        body.setText(text);
        body.setTextColor(0xFFE5E7EB);
        body.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        body.setLineSpacing(0f, 1.35f);
        body.setTypeface(body.getTypeface(), android.graphics.Typeface.ITALIC);
        body.setPadding(dp(2), dp(2), dp(2), dp(4));
        reasoningContainer.addView(body);

        reasoningAccordion.setVisibility(View.VISIBLE);
        if (!source.isEmpty()) {
            updateAccordionLabel(reasoningAccordion, source);
        }
    }

    private void renderNotes(JSONObject notes) {
        notesContainer.removeAllViews();

        // Coach instructions editor renders ALWAYS — even on clients with
        // no other notes yet — so Shannon can write the first directive
        // from the activity without having to open the dashboard's Notes
        // modal.
        String currentInstructions = notes != null ? notes.optString("coach_instructions", "") : "";
        if ("null".equals(currentInstructions)) currentInstructions = "";
        addCoachInstructionsEditor(notesContainer, currentInstructions);

        // Count populated OTHER fields (not coach_instructions, which is
        // always rendered) for the accordion header count.
        int populatedOthers = 0;
        String[] readOnlyFields = {"goals", "personal_context", "communication_style",
                "injuries_limits", "running_notes"};
        if (notes != null) {
            for (String f : readOnlyFields) {
                String v = notes.optString(f, "");
                if (v != null && !v.trim().isEmpty() && !"null".equals(v)) populatedOthers++;
            }
        }

        if (populatedOthers == 0) {
            TextView empty = new TextView(this);
            empty.setText("No other notes saved yet — they auto-extract from replies over time.");
            empty.setTextColor(0xFF9CA3AF);
            empty.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            empty.setPadding(dp(2), dp(4), dp(2), dp(4));
            notesContainer.addView(empty);
        } else {
            int innerGap = dp(6);
            addNoteBlock(notesContainer, "Goals", notes.optString("goals", ""), innerGap);
            addNoteBlock(notesContainer, "Personal context", notes.optString("personal_context", ""), innerGap);
            addNoteBlock(notesContainer, "Communication style", notes.optString("communication_style", ""), innerGap);
            addNoteBlock(notesContainer, "Injuries / limits", notes.optString("injuries_limits", ""), innerGap);
            addNoteBlock(notesContainer, "Running notes", notes.optString("running_notes", ""), innerGap);
        }

        boolean hasInstructions = currentInstructions != null && !currentInstructions.trim().isEmpty();
        int totalCount = populatedOthers + (hasInstructions ? 1 : 0);
        updateAccordionLabel(notesAccordion,
                totalCount == 0 ? "empty" : (totalCount + (totalCount == 1 ? " field" : " fields")));
    }

    /**
     * Inline editable coach_instructions block at the top of the Notes
     * accordion. Pre-fills with the current value (or empty), exposes a
     * Save button that POSTs to /update-coach-instructions. Stashes the
     * EditText / Button / status TextView in fields so onSaveCoach
     * Instructions can read+update them.
     */
    private void addCoachInstructionsEditor(LinearLayout parent, String currentValue) {
        TextView lab = new TextView(this);
        lab.setText("COACH INSTRUCTIONS FOR AI");
        lab.setTextColor(0xFF60A5FA);
        lab.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        lab.setTypeface(Typeface.DEFAULT_BOLD);
        lab.setLetterSpacing(0.05f);
        LinearLayout.LayoutParams labLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        labLp.bottomMargin = dp(4);
        lab.setLayoutParams(labLp);
        parent.addView(lab);

        TextView hint = new TextView(this);
        hint.setText("Persistent rules Shannon writes for the AI on this client. Overrides general voice. e.g. \"don't push the challenge\" / \"keep replies short\".");
        hint.setTextColor(0xFF94A3B8);
        hint.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        hint.setLineSpacing(0, 1.2f);
        LinearLayout.LayoutParams hintLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        hintLp.bottomMargin = dp(6);
        hint.setLayoutParams(hintLp);
        parent.addView(hint);

        coachInstructionsEdit = new EditText(this);
        coachInstructionsEdit.setText(currentValue == null ? "" : currentValue);
        coachInstructionsEdit.setTextColor(0xFFE5E7EB);
        coachInstructionsEdit.setHintTextColor(0xFF6B7280);
        coachInstructionsEdit.setHint("e.g. responds to vulnerability, ask deeper questions");
        coachInstructionsEdit.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        coachInstructionsEdit.setInputType(InputType.TYPE_CLASS_TEXT
                | InputType.TYPE_TEXT_FLAG_MULTI_LINE
                | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        coachInstructionsEdit.setMinLines(2);
        coachInstructionsEdit.setMaxLines(6);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xFF0C1B33);
        bg.setCornerRadius(dp(10));
        bg.setStroke(dp(1), 0xFF3B82F6);
        coachInstructionsEdit.setBackground(bg);
        int pad = dp(10);
        coachInstructionsEdit.setPadding(pad, pad, pad, pad);
        LinearLayout.LayoutParams editLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        editLp.bottomMargin = dp(6);
        coachInstructionsEdit.setLayoutParams(editLp);
        parent.addView(coachInstructionsEdit);

        LinearLayout actionRow = new LinearLayout(this);
        actionRow.setOrientation(LinearLayout.HORIZONTAL);
        actionRow.setGravity(android.view.Gravity.CENTER_VERTICAL);

        coachInstructionsStatus = new TextView(this);
        coachInstructionsStatus.setVisibility(View.GONE);
        coachInstructionsStatus.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        LinearLayout.LayoutParams statusLp = new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        coachInstructionsStatus.setLayoutParams(statusLp);
        actionRow.addView(coachInstructionsStatus);

        coachInstructionsSaveButton = new Button(this);
        coachInstructionsSaveButton.setText("Save");
        coachInstructionsSaveButton.setAllCaps(false);
        coachInstructionsSaveButton.setTextColor(Color.WHITE);
        coachInstructionsSaveButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        coachInstructionsSaveButton.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable btnBg = new GradientDrawable();
        btnBg.setColor(0xFF3B82F6);
        btnBg.setCornerRadius(dp(8));
        coachInstructionsSaveButton.setBackground(btnBg);
        int btnPadH = dp(14);
        int btnPadV = dp(8);
        coachInstructionsSaveButton.setPadding(btnPadH, btnPadV, btnPadH, btnPadV);
        coachInstructionsSaveButton.setMinHeight(0);
        coachInstructionsSaveButton.setMinWidth(0);
        coachInstructionsSaveButton.setMinimumWidth(0);
        coachInstructionsSaveButton.setOnClickListener(v -> onSaveCoachInstructions());
        actionRow.addView(coachInstructionsSaveButton);

        LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        rowLp.bottomMargin = dp(10);
        actionRow.setLayoutParams(rowLp);
        parent.addView(actionRow);

        // Visual divider so the editor reads as its own block before the
        // read-only fields below.
        View div = new View(this);
        div.setBackgroundColor(0xFF374151);
        LinearLayout.LayoutParams divLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 1);
        divLp.bottomMargin = dp(8);
        div.setLayoutParams(divLp);
        parent.addView(div);
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
            updateAccordionLabel(historyAccordion, "empty");
            return;
        }
        updateAccordionLabel(historyAccordion, msgs.length() + (msgs.length() == 1 ? " msg" : " msgs"));
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

            JSONArray media = m.optJSONArray("media");
            if (media != null) {
                for (int j = 0; j < media.length(); j++) {
                    JSONObject item = media.optJSONObject(j);
                    if (item == null) continue;
                    if (!"photo".equals(item.optString("type", ""))) continue;
                    String url = item.optString("url", "").trim();
                    if (url.isEmpty()) continue;
                    addHistoryPhoto(url, isCoach);
                }
            }
        }
    }

    private void addHistoryPhoto(String url, boolean isCoach) {
        ImageView img = new ImageView(this);
        img.setAdjustViewBounds(true);
        img.setScaleType(ImageView.ScaleType.FIT_CENTER);
        img.setMaxHeight(dp(280));
        img.setMinimumHeight(dp(120));
        img.setContentDescription("Photo from " + (isCoach ? "Shannon" : (clientName.isEmpty() ? "client" : clientName)));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xFF020617);
        bg.setCornerRadius(dp(8));
        bg.setStroke(dp(1), isCoach ? 0xFF16A34A : 0xFF475569);
        img.setBackground(bg);
        img.setPadding(dp(4), dp(4), dp(4), dp(4));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        lp.topMargin = dp(4);
        lp.bottomMargin = dp(4);
        img.setLayoutParams(lp);
        historyContainer.addView(img);
        loadRemotePhotoInto(img, url);
    }

    private void loadRemotePhotoInto(ImageView target, String url) {
        NET_EXECUTOR.submit(() -> {
            Bitmap bitmap = fetchBitmap(url);
            new Handler(Looper.getMainLooper()).post(() -> {
                if (bitmap == null) {
                    target.setVisibility(View.GONE);
                    return;
                }
                target.setImageBitmap(bitmap);
            });
        });
    }

    private static Bitmap fetchBitmap(String urlString) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlString);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36");
            conn.setRequestProperty("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8");
            conn.setConnectTimeout(7000);
            conn.setReadTimeout(12000);
            conn.setInstanceFollowRedirects(true);
            int status = conn.getResponseCode();
            if (status < 200 || status >= 300) return null;
            try (InputStream is = conn.getInputStream()) {
                return BitmapFactory.decodeStream(is);
            }
        } catch (Exception e) {
            Log.w(TAG, "photo load failed: " + e.getMessage());
            return null;
        } finally {
            if (conn != null) conn.disconnect();
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
        // Hide the reasoning accordion entirely on fetch failure rather
        // than leaving "Loading reasoning…" stuck — the error already
        // surfaces in the notes container above.
        if (reasoningAccordion != null) reasoningAccordion.setVisibility(View.GONE);
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
     * and add their own content via findViewWithTag("body"). The label
     * TextView is tagged "label" so callers can swap "Show X" / "Hide X"
     * after a fetch completes (with a count). Tapping the header toggles
     * body visibility and rotates the chevron.
     */
    private LinearLayout buildAccordion(String label, boolean defaultOpen,
                                        Consumer<TextView> chevronTagSetter) {
        LinearLayout accordion = new LinearLayout(this);
        accordion.setOrientation(LinearLayout.VERTICAL);
        applyPanelBackground(accordion);

        LinearLayout headerRow = new LinearLayout(this);
        headerRow.setOrientation(LinearLayout.HORIZONTAL);
        headerRow.setGravity(android.view.Gravity.CENTER_VERTICAL);
        int headerPadH = dp(12);
        int headerPadV = dp(11);
        headerRow.setPadding(headerPadH, headerPadV, headerPadH, headerPadV);
        headerRow.setClickable(true);
        headerRow.setFocusable(true);
        headerRow.setBackground(getResources().getDrawable(
                android.R.drawable.list_selector_background));

        TextView chevron = new TextView(this);
        chevron.setText("▸");
        chevron.setTextColor(0xFF60A5FA);
        chevron.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        chevron.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams chevLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        chevLp.rightMargin = dp(10);
        chevron.setLayoutParams(chevLp);
        if (chevronTagSetter != null) chevronTagSetter.accept(chevron);
        headerRow.addView(chevron);

        TextView labelTv = new TextView(this);
        // Lead with "Show" so it's obvious the header is a button. Swapped
        // to "Hide" + count once the user opens it. Pre-fetch the label
        // shows the bare topic so the activity isn't blank during loading.
        labelTv.setText("Show " + label);
        labelTv.setTextColor(0xFFE5E7EB);
        labelTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        labelTv.setTypeface(Typeface.DEFAULT_BOLD);
        labelTv.setTag("label");
        LinearLayout.LayoutParams lblLp = new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        labelTv.setLayoutParams(lblLp);
        headerRow.addView(labelTv);

        accordion.addView(headerRow);

        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setTag("body");
        int bodyPadH = dp(12);
        body.setPadding(bodyPadH, dp(2), bodyPadH, dp(12));
        body.setVisibility(defaultOpen ? View.VISIBLE : View.GONE);
        accordion.addView(body);

        // Stash topic + (later-supplied) count suffix in a HashMap on the
        // accordion's tag so updateAccordionLabel can rebuild the header
        // without the caller threading state in twice. Plain setTag(Object)
        // — no need for declared resource IDs.
        Map<String, String> state = new HashMap<>();
        state.put("topic", label);
        accordion.setTag(state);

        if (defaultOpen) {
            chevron.setRotation(90f);
            labelTv.setText("Hide " + label);
        }
        headerRow.setOnClickListener(v -> {
            boolean nowOpen = body.getVisibility() != View.VISIBLE;
            body.setVisibility(nowOpen ? View.VISIBLE : View.GONE);
            chevron.animate().rotation(nowOpen ? 90f : 0f).setDuration(150).start();
            @SuppressWarnings("unchecked")
            Map<String, String> s = (Map<String, String>) accordion.getTag();
            String topic = s != null ? s.get("topic") : label;
            String suffix = s != null ? s.get("count") : null;
            String prefix = nowOpen ? "Hide " : "Show ";
            labelTv.setText(prefix + topic + (suffix == null ? "" : "  ·  " + suffix));
        });

        return accordion;
    }

    /**
     * Update the count suffix on an accordion's label after fetched
     * content arrives ("Show Notes · 5 fields", "Show Recent messages · 7
     * total"). Caller passes the accordion's parent LinearLayout — same
     * one returned by buildAccordion.
     */
    @SuppressWarnings("unchecked")
    private void updateAccordionLabel(LinearLayout accordion, String countSuffix) {
        if (accordion == null) return;
        Map<String, String> state = (Map<String, String>) accordion.getTag();
        if (state == null) return;
        state.put("count", countSuffix == null ? "" : countSuffix);
        TextView labelTv = (TextView) accordion.findViewWithTag("label");
        LinearLayout body = (LinearLayout) accordion.findViewWithTag("body");
        if (labelTv == null || body == null) return;
        boolean isOpen = body.getVisibility() == View.VISIBLE;
        String topic = state.get("topic");
        if (topic == null) return;
        String prefix = isOpen ? "Hide " : "Show ";
        labelTv.setText(prefix + topic + (countSuffix == null || countSuffix.isEmpty() ? "" : "  ·  " + countSuffix));
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
        final String editReasonRaw = editReasonEdit != null && editReasonEdit.getText() != null
                ? editReasonEdit.getText().toString().trim()
                : "";
        final String editReason = editReasonRaw.length() > 240
                ? editReasonRaw.substring(0, 240)
                : editReasonRaw;

        NET_EXECUTOR.submit(() -> {
            PostResult result = postSchedule(alertId, trimmed, currentDraftText, delayMs, scheduleReason, editReason);
            new Handler(Looper.getMainLooper()).post(() -> {
                if (result.ok) {
                    NotificationManager nm =
                            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null && notificationId != -1) {
                        nm.cancel(notificationId);
                    }
                    CoachInboxWidgetProvider.requestRefresh(getApplicationContext());
                    Toast.makeText(getApplicationContext(),
                            "Scheduled for " + label,
                            Toast.LENGTH_SHORT).show();
                    finish();
                } else if (isTerminalFailure(result)) {
                    statusText.setText(formatPostError(result, "schedule"));
                    NotificationManager nm =
                            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null && notificationId != -1) nm.cancel(notificationId);
                    CoachInboxWidgetProvider.requestRefresh(getApplicationContext());
                    new Handler(Looper.getMainLooper()).postDelayed(this::finish, 1800);
                } else {
                    statusText.setText(formatPostError(result, "schedule"));
                    setChipsEnabled(true);
                }
            });
        });
    }

    private void setChipsEnabled(boolean enabled) {
        if (scheduleSpinner == null) return;
        scheduleSpinner.setEnabled(enabled);
        scheduleSpinner.setAlpha(enabled ? 1f : 0.5f);
        // On re-enable after a failure, snap back to the placeholder so the
        // next user pick produces a fresh onItemSelected event (Spinner skips
        // the listener when the new selection equals the current one).
        if (enabled) {
            scheduleSpinner.setSelection(0);
        }
    }

    /**
     * Build the visible spinner labels from the current clock — each preset
     * delay rendered as the wall-clock time it'd fire at ("3:05 PM" or
     * "Tomorrow 12:15 AM"). Index 0 is the placeholder.
     *
     * Snapshot at activity-open: if Shannon takes a while to pick, the
     * visible labels go stale by however long he took. The listener
     * re-formats at click time so the toast and the actual scheduled_for
     * stay in sync.
     */
    private String[] buildScheduleLabels() {
        String[] labels = new String[PRESET_DELAYS_MS.length];
        labels[0] = "— Pick a time —";
        for (int i = 1; i < PRESET_DELAYS_MS.length; i++) {
            labels[i] = formatDelayAsTimeLabel(PRESET_DELAYS_MS[i]);
        }
        return labels;
    }

    /**
     * Render a delta-from-now in ms as a wall-clock label, prefixed with
     * "Tomorrow " when the target lands on a different calendar day.
     * Respects the user's 12/24-hour system setting via getTimeFormat.
     */
    private String formatDelayAsTimeLabel(long delayMs) {
        java.text.DateFormat fmt = android.text.format.DateFormat.getTimeFormat(this);
        Calendar now = Calendar.getInstance();
        Calendar target = Calendar.getInstance();
        target.setTimeInMillis(now.getTimeInMillis() + delayMs);
        String timeStr = fmt.format(target.getTime());
        boolean isNextDay = target.get(Calendar.YEAR) != now.get(Calendar.YEAR)
                || target.get(Calendar.DAY_OF_YEAR) != now.get(Calendar.DAY_OF_YEAR);
        return isNextDay ? ("Tomorrow " + timeStr) : timeStr;
    }

    /**
     * Render the per-client voice match pill in the title row using the
     * stats returned by /coach-control-context. Hidden when the client
     * has no actioned drafts; greyed "VM N=X" when fewer than 3 samples;
     * colored green/blue/amber when there's enough data.
     */
    private void applyVoiceMatch(JSONObject vm) {
        if (voiceMatchPill == null) return;
        if (vm == null || vm.optInt("total", 0) == 0) {
            voiceMatchPill.setVisibility(View.GONE);
            return;
        }
        int total = vm.optInt("total", 0);
        int pct = vm.optInt("pct", 0);
        boolean enough = vm.optBoolean("enoughData", false);
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(10));
        if (!enough) {
            voiceMatchPill.setText("VM N=" + total);
            bg.setColor(0xFF1F2937);
            bg.setStroke(dp(1), 0xFF475569);
            voiceMatchPill.setTextColor(0xFF94A3B8);
        } else {
            voiceMatchPill.setText("VM " + pct + "%");
            if (pct >= 75) {
                bg.setColor(0xFF064E3B);
                bg.setStroke(dp(1), 0xFF10B981);
                voiceMatchPill.setTextColor(0xFF6EE7B7);
            } else if (pct >= 40) {
                bg.setColor(0xFF1E3A8A);
                bg.setStroke(dp(1), 0xFF60A5FA);
                voiceMatchPill.setTextColor(0xFFBFDBFE);
            } else {
                bg.setColor(0xFF78350F);
                bg.setStroke(dp(1), 0xFFF59E0B);
                voiceMatchPill.setTextColor(0xFFFDE68A);
            }
        }
        voiceMatchPill.setBackground(bg);
        voiceMatchPill.setVisibility(View.VISIBLE);
    }

    /**
     * Send Now — fires the (possibly edited) reply via /send-coach-reply.
     * Captures editReason if the reply differs from the original draft.
     * On success: dismisses notification, refreshes the inbox widget,
     * shows toast, finishes.
     */
    private void onSendNow() {
        if (sendNowButton == null) return;
        sendNowButton.setEnabled(false);
        sendNowButton.setText("Sending…");
        statusText.setVisibility(View.VISIBLE);
        statusText.setText("Sending…");

        final String replyText = replyEdit.getText() == null
                ? currentDraftText : replyEdit.getText().toString();
        final String trimmed = replyText.trim();
        if (trimmed.isEmpty()) {
            Toast.makeText(this, "Reply is empty", Toast.LENGTH_SHORT).show();
            sendNowButton.setEnabled(true);
            sendNowButton.setText("Send now");
            statusText.setVisibility(View.GONE);
            return;
        }
        final String editReasonRaw = editReasonEdit != null && editReasonEdit.getText() != null
                ? editReasonEdit.getText().toString().trim() : "";
        final String editReason = editReasonRaw.length() > 240
                ? editReasonRaw.substring(0, 240) : editReasonRaw;

        NET_EXECUTOR.submit(() -> {
            PostResult result = postSendNow(alertId, trimmed, currentDraftText, editReason);
            new Handler(Looper.getMainLooper()).post(() -> {
                if (result.ok) {
                    NotificationManager nm =
                            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null && notificationId != -1) nm.cancel(notificationId);
                    CoachInboxWidgetProvider.requestRefresh(getApplicationContext());
                    Toast.makeText(getApplicationContext(), "Sent ✓", Toast.LENGTH_SHORT).show();
                    finish();
                } else if (isTerminalFailure(result)) {
                    statusText.setText(formatPostError(result, "send"));
                    NotificationManager nm =
                            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null && notificationId != -1) nm.cancel(notificationId);
                    CoachInboxWidgetProvider.requestRefresh(getApplicationContext());
                    new Handler(Looper.getMainLooper()).postDelayed(this::finish, 1800);
                } else {
                    statusText.setText(formatPostError(result, "send"));
                    sendNowButton.setEnabled(true);
                    sendNowButton.setText("Send now");
                }
            });
        });
    }

    /**
     * Redraft — POST a hint to /redraft-coach-reply, swap the new draft
     * into replyEdit on success. Reflects in currentDraftText so the
     * "did you edit it?" check uses the redrafted version as the
     * baseline.
     */
    private void onRedraft() {
        if (redraftHintEdit == null || redraftGoButton == null) return;
        final String hintRaw = redraftHintEdit.getText() == null
                ? "" : redraftHintEdit.getText().toString().trim();
        if (hintRaw.isEmpty()) {
            redraftHintEdit.requestFocus();
            return;
        }
        final String hint = hintRaw.length() > 500 ? hintRaw.substring(0, 500) : hintRaw;
        redraftGoButton.setEnabled(false);
        redraftGoButton.setText("…");

        NET_EXECUTOR.submit(() -> {
            String newText = postRedraft(alertId, hint);
            new Handler(Looper.getMainLooper()).post(() -> {
                redraftGoButton.setEnabled(true);
                redraftGoButton.setText("Redraft");
                if (newText != null && !newText.isEmpty()) {
                    currentDraftText = newText;
                    replyEdit.setText(newText);
                    replyEdit.setSelection(newText.length());
                    redraftHintEdit.setText("");
                    Toast.makeText(getApplicationContext(), "Redraft updated", Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(getApplicationContext(), "Redraft failed — try a different hint", Toast.LENGTH_SHORT).show();
                }
            });
        });
    }

    /**
     * Save coach instructions for this client — calls update-coach-
     * instructions which upserts client_memory.coach_instructions. The
     * next AI draft for this client will see the new directive.
     */
    private void onSaveCoachInstructions() {
        if (coachInstructionsEdit == null || coachInstructionsSaveButton == null) return;
        final String raw = coachInstructionsEdit.getText() == null
                ? "" : coachInstructionsEdit.getText().toString().trim();
        coachInstructionsSaveButton.setEnabled(false);
        coachInstructionsSaveButton.setText("Saving…");
        if (coachInstructionsStatus != null) coachInstructionsStatus.setVisibility(View.GONE);

        NET_EXECUTOR.submit(() -> {
            boolean ok = postUpdateCoachInstructions(alertId, raw);
            new Handler(Looper.getMainLooper()).post(() -> {
                coachInstructionsSaveButton.setEnabled(true);
                coachInstructionsSaveButton.setText("Save");
                if (coachInstructionsStatus != null) {
                    coachInstructionsStatus.setVisibility(View.VISIBLE);
                    coachInstructionsStatus.setText(ok
                            ? "Saved · next draft picks it up"
                            : "Couldn't save. Try again.");
                    coachInstructionsStatus.setTextColor(ok ? 0xFF6EE7B7 : 0xFFFBBF24);
                }
            });
        });
    }

    /**
     * Toggle visibility of the dismiss reason row. First tap on "Forget"
     * opens the row + focuses the reason input. Second tap collapses it.
     */
    private void toggleDismissRow() {
        if (dismissRow == null) return;
        boolean wasVisible = dismissRow.getVisibility() == View.VISIBLE;
        dismissRow.setVisibility(wasVisible ? View.GONE : View.VISIBLE);
        if (!wasVisible && dismissReasonEdit != null) {
            dismissReasonEdit.requestFocus();
        }
    }

    /**
     * Dismiss/Forget — POST to /dismiss-coach-reply with the optional
     * reason. On success: cancel the notification, refresh the inbox
     * widget, and finish the activity. Mirrors the web DMs tab's
     * dismissAlert flow.
     */
    private void onDismiss() {
        if (dismissButton == null) return;
        dismissButton.setEnabled(false);
        dismissButton.setText("…");
        statusText.setVisibility(View.VISIBLE);
        statusText.setText("Dismissing…");

        final String reasonRaw = dismissReasonEdit != null && dismissReasonEdit.getText() != null
                ? dismissReasonEdit.getText().toString().trim() : "";
        final String reason = reasonRaw.length() > 240 ? reasonRaw.substring(0, 240) : reasonRaw;

        NET_EXECUTOR.submit(() -> {
            boolean ok = postDismiss(alertId, reason);
            new Handler(Looper.getMainLooper()).post(() -> {
                if (ok) {
                    NotificationManager nm =
                            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null && notificationId != -1) nm.cancel(notificationId);
                    CoachInboxWidgetProvider.requestRefresh(getApplicationContext());
                    Toast.makeText(getApplicationContext(), "Dismissed", Toast.LENGTH_SHORT).show();
                    finish();
                } else {
                    statusText.setText("Couldn't dismiss. Try again.");
                    dismissButton.setEnabled(true);
                    dismissButton.setText("Dismiss");
                }
            });
        });
    }

    private static boolean postDismiss(String alertId, String reason) {
        HttpURLConnection conn = null;
        try {
            JSONObject payload = new JSONObject();
            payload.put("alertId", alertId);
            if (reason != null && !reason.isEmpty()) {
                payload.put("reason", reason);
            }
            payload.put("source", "android_control");
            URL url = new URL(DISMISS_ENDPOINT);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(7000);
            conn.setReadTimeout(15000);
            byte[] body = payload.toString().getBytes("UTF-8");
            conn.setFixedLengthStreamingMode(body.length);
            try (OutputStream os = conn.getOutputStream()) { os.write(body); }
            int code = conn.getResponseCode();
            return code >= 200 && code < 300;
        } catch (Exception e) {
            Log.e(TAG, "dismiss POST failed: " + e.getMessage(), e);
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static String postRedraft(String alertId, String hint) {
        HttpURLConnection conn = null;
        try {
            JSONObject payload = new JSONObject();
            payload.put("alertId", alertId);
            payload.put("hint", hint);
            URL url = new URL("https://plantbased-balance.org/.netlify/functions/redraft-coach-reply");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(7000);
            conn.setReadTimeout(20000); // model call can be slow
            byte[] body = payload.toString().getBytes("UTF-8");
            conn.setFixedLengthStreamingMode(body.length);
            try (OutputStream os = conn.getOutputStream()) { os.write(body); }
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                Log.w(TAG, "redraft non-2xx: " + code);
                return null;
            }
            try (InputStream is = conn.getInputStream()) {
                StringBuilder sb = new StringBuilder();
                BufferedReader r = new BufferedReader(new InputStreamReader(is, "UTF-8"));
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
                JSONObject root = new JSONObject(sb.toString());
                String s = root.optString("suggested_message", "");
                return s.isEmpty() ? null : s;
            }
        } catch (Exception e) {
            Log.e(TAG, "redraft POST failed: " + e.getMessage(), e);
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static PostResult postSendNow(String alertId, String replyText,
                                          String draftText, String editReason) {
        HttpURLConnection conn = null;
        try {
            JSONObject payload = new JSONObject();
            payload.put("alertId", alertId);
            payload.put("replyText", replyText);
            payload.put("draftText", draftText == null ? "" : draftText);
            payload.put("source", "android_control_send_now");
            if (editReason != null && !editReason.isEmpty()) {
                payload.put("editReason", editReason);
            }
            URL url = new URL("https://plantbased-balance.org/.netlify/functions/send-coach-reply");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(7000);
            conn.setReadTimeout(15000);
            byte[] body = payload.toString().getBytes("UTF-8");
            conn.setFixedLengthStreamingMode(body.length);
            try (OutputStream os = conn.getOutputStream()) { os.write(body); }
            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) return PostResult.success(code);
            return PostResult.failure(code, readServerError(conn));
        } catch (Exception e) {
            Log.e(TAG, "sendNow POST failed: " + e.getMessage(), e);
            return PostResult.network(e.getMessage());
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static boolean postUpdateCoachInstructions(String alertId, String text) {
        HttpURLConnection conn = null;
        try {
            JSONObject payload = new JSONObject();
            payload.put("alertId", alertId);
            payload.put("coachInstructions", text == null ? "" : text);
            URL url = new URL("https://plantbased-balance.org/.netlify/functions/update-coach-instructions");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(7000);
            conn.setReadTimeout(15000);
            byte[] body = payload.toString().getBytes("UTF-8");
            conn.setFixedLengthStreamingMode(body.length);
            try (OutputStream os = conn.getOutputStream()) { os.write(body); }
            int code = conn.getResponseCode();
            return code >= 200 && code < 300;
        } catch (Exception e) {
            Log.e(TAG, "updateCoachInstructions POST failed: " + e.getMessage(), e);
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static PostResult postSchedule(String alertId, String replyText,
                                           String draftText, long delayMs,
                                           String scheduleReason, String editReason) {
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
            if (editReason != null && !editReason.isEmpty()) {
                payload.put("editReason", editReason);
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
            if (code >= 200 && code < 300) return PostResult.success(code);
            String serverError = readServerError(conn);
            Log.w(TAG, "schedule-coach-reply non-2xx: " + code + (serverError == null ? "" : " — " + serverError));
            return PostResult.failure(code, serverError);
        } catch (Exception e) {
            Log.e(TAG, "schedule POST failed: " + e.getMessage(), e);
            return PostResult.network(e.getMessage());
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /**
     * Carries the outcome of a POST to send-coach-reply / schedule-coach-reply
     * so the UI can show the actual server error instead of a generic
     * "couldn't send / schedule, try again". httpCode == 0 means a network
     * exception fired before the server saw the request.
     */
    private static final class PostResult {
        final int httpCode;
        final boolean ok;
        final String serverError;
        private PostResult(int httpCode, boolean ok, String serverError) {
            this.httpCode = httpCode; this.ok = ok; this.serverError = serverError;
        }
        static PostResult success(int code) { return new PostResult(code, true, null); }
        static PostResult failure(int code, String err) { return new PostResult(code, false, err); }
        static PostResult network(String detail) { return new PostResult(0, false, detail); }
    }

    /**
     * Drain HttpURLConnection.getErrorStream() and pull the JSON `error`
     * field if present. Falls back to a truncated raw body so the UI has
     * something to show when the response isn't JSON.
     */
    private static String readServerError(HttpURLConnection conn) {
        InputStream is = null;
        try {
            is = conn.getErrorStream();
            if (is == null) return null;
            StringBuilder sb = new StringBuilder();
            BufferedReader r = new BufferedReader(new InputStreamReader(is, "UTF-8"));
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            String raw = sb.toString().trim();
            if (raw.isEmpty()) return null;
            try {
                JSONObject body = new JSONObject(raw);
                String err = body.optString("error", "").trim();
                if (!err.isEmpty()) return err;
            } catch (Exception ignored) { /* not JSON, fall through */ }
            return raw.length() > 200 ? raw.substring(0, 200) : raw;
        } catch (Exception e) {
            return null;
        } finally {
            if (is != null) try { is.close(); } catch (Exception ignored) {}
        }
    }

    /** User-facing wording for a failed post — distinguishes terminal
     *  states (already actioned, not found) from retryable ones. */
    private static String formatPostError(PostResult result, String action) {
        if (result.httpCode == 409) {
            return "This draft was already sent or dismissed.";
        }
        if (result.httpCode == 404) {
            return "Draft not found — it may have been replaced.";
        }
        if (result.httpCode == 0) {
            return "Network error — check connection and try again.";
        }
        if (result.serverError != null && !result.serverError.isEmpty()) {
            return "Couldn't " + action + " (" + result.httpCode + "): " + result.serverError;
        }
        return "Couldn't " + action + " (HTTP " + result.httpCode + "). Try again.";
    }

    /** True when the alert is in a terminal state on the server, so
     *  retrying won't help — the activity should auto-close. */
    private static boolean isTerminalFailure(PostResult result) {
        return result.httpCode == 409 || result.httpCode == 404;
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
