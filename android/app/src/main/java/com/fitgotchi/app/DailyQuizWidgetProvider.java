package com.fitgotchi.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

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

/**
 * Android home-screen micro quiz. App widgets cannot host the full WebView
 * lesson UI, so this renders a simple tap-only daily quiz directly in
 * RemoteViews and syncs the perfect-score daily bonus when a cached session
 * is available.
 */
public class DailyQuizWidgetProvider extends AppWidgetProvider {
    private static final String ACTION_ANSWER = "com.fitgotchi.app.ACTION_DAILY_QUIZ_ANSWER";
    private static final String ACTION_RESTART = "com.fitgotchi.app.ACTION_DAILY_QUIZ_RESTART";
    private static final String ACTION_RETRY = "com.fitgotchi.app.ACTION_DAILY_QUIZ_RETRY";
    private static final String ACTION_ASK_BALANCE_ROUTE = "com.fitgotchi.app.ACTION_ASK_BALANCE_ROUTE";
    private static final String EXTRA_ASK_BALANCE_TARGET = "balance_target";
    private static final String EXTRA_WIDGET_ID = "widget_id";
    private static final String EXTRA_CHOICE = "choice";

    private static final String PREFS_NAME = "daily_quiz_widget_prefs";
    private static final String SNAPSHOT_JSON_KEY = "snapshot_json";
    private static final int QUIZ_LENGTH = 8;
    private static final int PERFECT_XP = 5;
    private static final int NO_CHOICE = -1;
    private static final int CORRECT_FEEDBACK_DELAY_MS = 850;
    private static final int WRONG_FEEDBACK_DELAY_MS = 950;

    private static final Question[] QUESTION_POOL = new Question[] {
        q("For plant protein, what matters most across the day?",
            new String[] {"Total protein", "Only dinner", "Avoid legumes", "Zero carbs"}, 0),
        q("Tap the first step for a habit that sticks.",
            new String[] {"Make it tiny", "Buy supplements", "Train harder", "Skip planning"}, 0),
        q("Best post-workout plate?",
            new String[] {"Protein + carbs", "Just coffee", "Only fats", "Nothing"}, 0),
        q("What helps sleep quality most?",
            new String[] {"Consistent bedtime", "Late caffeine", "Bright phone", "Random naps"}, 0),
        q("Which swap adds fiber fastest?",
            new String[] {"Beans or lentils", "White bread", "Oil", "Juice"}, 0),
        q("Tap the better cardio habit.",
            new String[] {"Walk daily", "One huge day", "Avoid stairs", "Only stretch"}, 0),
        q("What drives progress photos?",
            new String[] {"Same pose and light", "Random angles", "Zoomed mirror", "Dark room"}, 0),
        q("Tap the recovery signal.",
            new String[] {"Energy improving", "Worse sleep", "Sore forever", "No appetite"}, 0),
        q("Best way to build strength?",
            new String[] {"Progress gradually", "Max out daily", "Skip warmups", "Guess weights"}, 0),
        q("Tap the meal prep win.",
            new String[] {"Protein ready", "Empty fridge", "No snacks", "Skip lunch"}, 0),
        q("For hunger, which helps most?",
            new String[] {"Protein + fiber", "Sugary drinks", "Tiny meals", "No breakfast"}, 0),
        q("Tap the best hydration cue.",
            new String[] {"Pale yellow urine", "Headache only", "Dark urine", "Never thirsty"}, 0),
        q("What makes fat loss sustainable?",
            new String[] {"Small deficit", "Crash diet", "No carbs ever", "Daily punishment"}, 0),
        q("Tap the first form-check step.",
            new String[] {"Film the set", "Guess the issue", "Add weight", "Rush reps"}, 0),
        q("Which mindset helps consistency?",
            new String[] {"Next meal counts", "Day is ruined", "Wait Monday", "All or nothing"}, 0)
    };

    static void saveSnapshot(Context context, String json) {
        try {
            QuizSnapshot snapshot = QuizSnapshot.fromJson(json);
            if (!snapshot.hasQuestions()) return;
            prefs(context).edit()
                    .putString(SNAPSHOT_JSON_KEY, snapshot.rawJson)
                    .apply();
            updateAll(context);
        } catch (Exception ignored) { }
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, DailyQuizWidgetProvider.class));
        for (int id : ids) updateWidget(context, manager, id);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();
        int appWidgetId = intent.getIntExtra(EXTRA_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return;

        if (ACTION_RESTART.equals(action)) {
            WidgetState current = WidgetState.load(context, appWidgetId);
            int nextRound = current.round + 1;
            QuizSnapshot snapshot = QuizSnapshot.load(context, nextRound);
            WidgetState.fresh(snapshot.date, snapshot.lessonId, nextRound).save(context, appWidgetId);
            updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
            return;
        }

        if (ACTION_RETRY.equals(action)) {
            WidgetState state = WidgetState.load(context, appWidgetId);
            QuizSnapshot snapshot = QuizSnapshot.load(context, state.round);
            if (!snapshot.matches(state)) state = WidgetState.fresh(snapshot.date, snapshot.lessonId, state.round);
            state.clearFeedback();
            state.save(context, appWidgetId);
            updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
            return;
        }

        if (ACTION_ANSWER.equals(action)) {
            WidgetState state = WidgetState.load(context, appWidgetId);
            QuizSnapshot snapshot = QuizSnapshot.load(context, state.round);
            if (!snapshot.hasQuestions()) {
                updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
                return;
            }
            int choice = intent.getIntExtra(EXTRA_CHOICE, -1);
            if (!snapshot.matches(state)) state = WidgetState.fresh(snapshot.date, snapshot.lessonId, state.round);
            Question question = snapshot.questionAt(state.index);
            if (state.completed || choice < 0 || choice >= question.options.length || state.isLocked()) {
                updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
                return;
            }

            boolean correct = choice == question.answerIndex;
            state.feedbackChoice = choice;
            state.feedbackCorrect = correct;
            if (correct) state.score++;
            state.save(context, appWidgetId);
            updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
            if (correct) {
                advanceAfterCorrectFeedback(context, appWidgetId, state.date, state.snapshotId, state.round, state.index, choice, goAsync());
            } else {
                showHintAfterWrongFeedback(context, appWidgetId, state.date, state.snapshotId, state.round, state.index, choice, goAsync());
            }
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        WidgetState state = WidgetState.load(context, appWidgetId);
        QuizSnapshot snapshot = QuizSnapshot.load(context, state.round);
        if (!snapshot.matches(state)) {
            state = WidgetState.fresh(snapshot.date, snapshot.lessonId, state.round);
            state.save(context, appWidgetId);
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_daily_quiz);
        views.setTextViewText(R.id.widget_daily_quiz_progress, progressText(state, snapshot));

        if (!snapshot.hasQuestions()) {
            renderSyncPrompt(context, views, appWidgetId);
        } else if (state.completed) {
            renderComplete(context, views, appWidgetId, state, snapshot);
        } else {
            renderQuestion(context, views, appWidgetId, state, snapshot);
        }

        manager.updateAppWidget(appWidgetId, views);
    }

    private static void renderSyncPrompt(Context context, RemoteViews views, int appWidgetId) {
        views.setTextViewText(R.id.widget_daily_quiz_title, "Daily Quiz");
        views.setTextViewText(R.id.widget_daily_quiz_progress, "Sync");
        views.setTextViewText(R.id.widget_daily_quiz_question, "Open Balance for fresh Health IQ lessons.");
        views.setTextViewText(R.id.widget_daily_quiz_option_1, "Open Balance");
        views.setTextViewText(R.id.widget_daily_quiz_option_2, "Learning tab");
        views.setViewVisibility(R.id.widget_daily_quiz_option_1, View.VISIBLE);
        views.setViewVisibility(R.id.widget_daily_quiz_option_2, View.VISIBLE);
        applyOptionStyle(views, R.id.widget_daily_quiz_option_1, R.drawable.widget_daily_quiz_option_background);
        applyOptionStyle(views, R.id.widget_daily_quiz_option_2, R.drawable.widget_daily_quiz_option_background);
        views.setViewVisibility(R.id.widget_daily_quiz_option_3, View.GONE);
        views.setViewVisibility(R.id.widget_daily_quiz_option_4, View.GONE);
        views.setViewVisibility(R.id.widget_daily_quiz_restart, View.GONE);
        PendingIntent open = openAppIntent(context, appWidgetId + 7000);
        views.setOnClickPendingIntent(R.id.widget_daily_quiz_option_1, open);
        views.setOnClickPendingIntent(R.id.widget_daily_quiz_option_2, open);
        views.setOnClickPendingIntent(R.id.widget_daily_quiz_root, open);
    }

    private static void renderQuestion(Context context, RemoteViews views, int appWidgetId, WidgetState state, QuizSnapshot snapshot) {
        Question question = snapshot.questionAt(state.index);
        if (state.isShowingHint()) {
            renderHint(context, views, appWidgetId, question, snapshot);
            return;
        }

        boolean showingFeedback = state.isShowingFeedback();
        views.setTextViewText(R.id.widget_daily_quiz_title, showingFeedback ? (state.feedbackCorrect ? "Correct" : "Not Quite") : snapshot.title);
        views.setTextViewText(R.id.widget_daily_quiz_question, showingFeedback ? feedbackQuestionText(state, question) : question.text);
        views.setViewVisibility(R.id.widget_daily_quiz_restart, View.GONE);

        int[] ids = optionIds();
        for (int i = 0; i < ids.length; i++) {
            if (i < question.options.length) {
                views.setTextViewText(ids[i], question.options[i]);
                views.setViewVisibility(ids[i], View.VISIBLE);
                applyOptionStyle(views, ids[i], optionBackgroundFor(state, question, i));
                views.setOnClickPendingIntent(ids[i], answerIntent(context, appWidgetId, i));
            } else {
                views.setViewVisibility(ids[i], View.GONE);
            }
        }
    }

    private static void renderHint(Context context, RemoteViews views, int appWidgetId, Question question, QuizSnapshot snapshot) {
        views.setTextViewText(R.id.widget_daily_quiz_title, "A Hint");
        views.setTextViewText(R.id.widget_daily_quiz_question, hintText(question, snapshot));
        views.setTextViewText(R.id.widget_daily_quiz_option_1, "Try again");
        views.setTextViewText(R.id.widget_daily_quiz_option_2, "Open lesson");
        views.setViewVisibility(R.id.widget_daily_quiz_option_1, View.VISIBLE);
        views.setViewVisibility(R.id.widget_daily_quiz_option_2, View.VISIBLE);
        views.setViewVisibility(R.id.widget_daily_quiz_option_3, View.GONE);
        views.setViewVisibility(R.id.widget_daily_quiz_option_4, View.GONE);
        views.setViewVisibility(R.id.widget_daily_quiz_restart, View.GONE);
        applyOptionStyle(views, R.id.widget_daily_quiz_option_1, R.drawable.widget_daily_quiz_option_correct_background);
        applyOptionStyle(views, R.id.widget_daily_quiz_option_2, R.drawable.widget_daily_quiz_option_background);
        views.setOnClickPendingIntent(R.id.widget_daily_quiz_option_1, retryIntent(context, appWidgetId));
        views.setOnClickPendingIntent(R.id.widget_daily_quiz_option_2, openAppIntent(context, appWidgetId + 8000));
    }

    private static void renderComplete(Context context, RemoteViews views, int appWidgetId, WidgetState state, QuizSnapshot snapshot) {
        boolean perfect = state.score == snapshot.length();
        views.setTextViewText(R.id.widget_daily_quiz_title, perfect ? "Perfect" : "Good Try");
        views.setTextViewText(R.id.widget_daily_quiz_question, completionText(state, snapshot));
        views.setTextViewText(R.id.widget_daily_quiz_option_1, "Next quiz");
        views.setTextViewText(R.id.widget_daily_quiz_option_2, "Open app");
        views.setViewVisibility(R.id.widget_daily_quiz_option_1, View.VISIBLE);
        views.setViewVisibility(R.id.widget_daily_quiz_option_2, View.VISIBLE);
        applyOptionStyle(views, R.id.widget_daily_quiz_option_1, R.drawable.widget_daily_quiz_option_background);
        applyOptionStyle(views, R.id.widget_daily_quiz_option_2, R.drawable.widget_daily_quiz_option_background);
        views.setViewVisibility(R.id.widget_daily_quiz_option_3, View.GONE);
        views.setViewVisibility(R.id.widget_daily_quiz_option_4, View.GONE);
        views.setViewVisibility(R.id.widget_daily_quiz_restart, View.GONE);
        views.setOnClickPendingIntent(R.id.widget_daily_quiz_option_1, restartIntent(context, appWidgetId));
        views.setOnClickPendingIntent(R.id.widget_daily_quiz_option_2, openAppIntent(context, appWidgetId + 5000));
    }

    private static String feedbackQuestionText(WidgetState state, Question question) {
        if (state.feedbackCorrect) return "Nice, that's right. Next question...";
        String answer = question.options[Math.min(Math.max(question.answerIndex, 0), question.options.length - 1)];
        return "Not quite. Correct answer: " + answer;
    }

    private static String hintText(Question question, QuizSnapshot snapshot) {
        if (question.explanation != null && !question.explanation.isEmpty()) return question.explanation;
        if (snapshot.defaultHint != null && !snapshot.defaultHint.isEmpty()) return snapshot.defaultHint;
        return "Look at the green answer, then try this question again.";
    }

    private static int optionBackgroundFor(WidgetState state, Question question, int optionIndex) {
        if (!state.isShowingFeedback()) return R.drawable.widget_daily_quiz_option_background;
        if (optionIndex == question.answerIndex) return R.drawable.widget_daily_quiz_option_correct_background;
        if (optionIndex == state.feedbackChoice) return R.drawable.widget_daily_quiz_option_wrong_background;
        return R.drawable.widget_daily_quiz_option_background;
    }

    private static void applyOptionStyle(RemoteViews views, int viewId, int backgroundResId) {
        views.setInt(viewId, "setBackgroundResource", backgroundResId);
        views.setTextColor(viewId, 0xFFFFFFFF);
    }

    private static String completionText(WidgetState state, QuizSnapshot snapshot) {
        int length = snapshot.length();
        if (state.score < length) return state.score + "/" + length + " correct. Tap Next quiz and go again.";
        String perfectScore = length + "/" + length + " correct. ";
        if ("awarded".equals(state.awardState)) return perfectScore + "+5 XP synced.";
        if ("already".equals(state.awardState)) return perfectScore + "Daily XP already synced.";
        if ("signin".equals(state.awardState)) return perfectScore + "Open Balance once to sync XP.";
        if ("error".equals(state.awardState)) return perfectScore + "Open Balance to sync XP.";
        return perfectScore + "Syncing +5 XP...";
    }

    private static String progressText(WidgetState state, QuizSnapshot snapshot) {
        int length = snapshot.length();
        if (length <= 0) return "Sync";
        if (state.completed) return state.score + "/" + length;
        return (Math.min(state.index + 1, length)) + "/" + length;
    }

    private static void advanceAfterCorrectFeedback(
            Context context,
            int appWidgetId,
            String date,
            String snapshotId,
            int round,
            int index,
            int choice,
            android.content.BroadcastReceiver.PendingResult pendingResult
    ) {
        final Context appContext = context.getApplicationContext();
        new Thread(() -> {
            try {
                Thread.sleep(CORRECT_FEEDBACK_DELAY_MS);
                WidgetState state = WidgetState.load(appContext, appWidgetId);
                QuizSnapshot snapshot = QuizSnapshot.load(appContext, state.round);
                if (!date.equals(state.date)
                        || !snapshotId.equals(state.snapshotId)
                        || round != state.round
                        || index != state.index
                        || choice != state.feedbackChoice
                        || !state.feedbackCorrect
                        || !state.isShowingFeedback()
                        || !snapshot.matches(state)) {
                    updateWidget(appContext, AppWidgetManager.getInstance(appContext), appWidgetId);
                    return;
                }

                state.clearFeedback();
                state.index++;
                if (state.index >= snapshot.length()) {
                    state.completed = true;
                    if (state.score == snapshot.length()) state.awardState = "pending";
                }
                state.save(appContext, appWidgetId);
                updateWidget(appContext, AppWidgetManager.getInstance(appContext), appWidgetId);
                if (state.completed && "pending".equals(state.awardState)) {
                    syncPerfectScore(appContext, appWidgetId, null);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                if (pendingResult != null) pendingResult.finish();
            }
        }, "daily-quiz-widget-correct").start();
    }

    private static void showHintAfterWrongFeedback(
            Context context,
            int appWidgetId,
            String date,
            String snapshotId,
            int round,
            int index,
            int choice,
            android.content.BroadcastReceiver.PendingResult pendingResult
    ) {
        final Context appContext = context.getApplicationContext();
        new Thread(() -> {
            try {
                Thread.sleep(WRONG_FEEDBACK_DELAY_MS);
                WidgetState state = WidgetState.load(appContext, appWidgetId);
                QuizSnapshot snapshot = QuizSnapshot.load(appContext, state.round);
                if (!date.equals(state.date)
                        || !snapshotId.equals(state.snapshotId)
                        || round != state.round
                        || index != state.index
                        || choice != state.feedbackChoice
                        || state.feedbackCorrect
                        || !state.isShowingFeedback()
                        || !snapshot.matches(state)) {
                    updateWidget(appContext, AppWidgetManager.getInstance(appContext), appWidgetId);
                    return;
                }

                state.showingHint = true;
                state.save(appContext, appWidgetId);
                updateWidget(appContext, AppWidgetManager.getInstance(appContext), appWidgetId);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                if (pendingResult != null) pendingResult.finish();
            }
        }, "daily-quiz-widget-hint").start();
    }

    private static PendingIntent answerIntent(Context context, int appWidgetId, int choice) {
        Intent intent = new Intent(context, DailyQuizWidgetProvider.class);
        intent.setAction(ACTION_ANSWER);
        intent.putExtra(EXTRA_WIDGET_ID, appWidgetId);
        intent.putExtra(EXTRA_CHOICE, choice);
        return PendingIntent.getBroadcast(context, appWidgetId * 100 + choice, intent, pendingFlags());
    }

    private static PendingIntent restartIntent(Context context, int appWidgetId) {
        Intent intent = new Intent(context, DailyQuizWidgetProvider.class);
        intent.setAction(ACTION_RESTART);
        intent.putExtra(EXTRA_WIDGET_ID, appWidgetId);
        return PendingIntent.getBroadcast(context, appWidgetId * 100 + 90, intent, pendingFlags());
    }

    private static PendingIntent retryIntent(Context context, int appWidgetId) {
        Intent intent = new Intent(context, DailyQuizWidgetProvider.class);
        intent.setAction(ACTION_RETRY);
        intent.putExtra(EXTRA_WIDGET_ID, appWidgetId);
        return PendingIntent.getBroadcast(context, appWidgetId * 100 + 91, intent, pendingFlags());
    }

    private static PendingIntent openAppIntent(Context context, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(ACTION_ASK_BALANCE_ROUTE);
        intent.putExtra(EXTRA_ASK_BALANCE_TARGET, "daily-quiz");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, pendingFlags());
    }

    private static int pendingFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return flags;
    }

    private static int[] optionIds() {
        return new int[] {
            R.id.widget_daily_quiz_option_1,
            R.id.widget_daily_quiz_option_2,
            R.id.widget_daily_quiz_option_3,
            R.id.widget_daily_quiz_option_4
        };
    }

    private static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private static void syncPerfectScore(
            Context context,
            int appWidgetId,
            android.content.BroadcastReceiver.PendingResult pendingResult
    ) {
        final Context appContext = context.getApplicationContext();
        new Thread(() -> {
            WidgetState state = WidgetState.load(appContext, appWidgetId);
            try {
                NativeBalanceSession.Session session = NativeBalanceSession.getValid(appContext);
                if (dailyMilestoneExists(session, state.date)) {
                    state.awardState = "already";
                } else {
                    insertDailyMilestone(session, state.date);
                    addLifetimeXp(session, PERFECT_XP);
                    state.awardState = "awarded";
                }
            } catch (NativeBalanceSession.AuthRequiredException e) {
                state.awardState = "signin";
            } catch (Exception e) {
                state.awardState = "error";
            }
            try {
                state.save(appContext, appWidgetId);
                updateWidget(appContext, AppWidgetManager.getInstance(appContext), appWidgetId);
            } finally {
                if (pendingResult != null) pendingResult.finish();
            }
        }, "daily-quiz-widget-sync").start();
    }

    private static boolean dailyMilestoneExists(NativeBalanceSession.Session session, String date) throws Exception {
        String url = NativeBalanceSession.SUPABASE_URL + "/rest/v1/learning_milestones"
            + "?user_id=eq." + enc(session.userId)
            + "&milestone_type=eq.daily_quiz"
            + "&milestone_id=eq." + enc(date)
            + "&select=id&limit=1";
        HttpURLConnection conn = authed(url, session, "GET");
        int code = conn.getResponseCode();
        String body = readBody(conn, code);
        conn.disconnect();
        if (code < 200 || code >= 300) throw new Exception("milestone lookup failed");
        JSONArray rows = new JSONArray(body == null || body.isEmpty() ? "[]" : body);
        return rows.length() > 0;
    }

    private static void insertDailyMilestone(NativeBalanceSession.Session session, String date) throws Exception {
        JSONObject row = new JSONObject();
        row.put("user_id", session.userId);
        row.put("milestone_type", "daily_quiz");
        row.put("milestone_id", date);
        row.put("xp_awarded", PERFECT_XP);
        HttpURLConnection conn = authed(NativeBalanceSession.SUPABASE_URL + "/rest/v1/learning_milestones", session, "POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Prefer", "return=minimal");
        writeJson(conn, row.toString());
        int code = conn.getResponseCode();
        readBody(conn, code);
        conn.disconnect();
        if (code < 200 || code >= 300) throw new Exception("milestone insert failed");
    }

    private static void addLifetimeXp(NativeBalanceSession.Session session, int amount) throws Exception {
        int lifetime = 0;
        boolean exists = false;
        String url = NativeBalanceSession.SUPABASE_URL + "/rest/v1/user_points"
            + "?user_id=eq." + enc(session.userId)
            + "&select=lifetime_points&limit=1";
        HttpURLConnection get = authed(url, session, "GET");
        int getCode = get.getResponseCode();
        String body = readBody(get, getCode);
        get.disconnect();
        if (getCode < 200 || getCode >= 300) throw new Exception("points lookup failed");
        JSONArray rows = new JSONArray(body == null || body.isEmpty() ? "[]" : body);
        if (rows.length() > 0) {
            exists = true;
            lifetime = rows.getJSONObject(0).optInt("lifetime_points", 0);
        }

        JSONObject payload = new JSONObject();
        if (exists) {
            payload.put("lifetime_points", lifetime + amount);
            HttpURLConnection patch = authed(
                NativeBalanceSession.SUPABASE_URL + "/rest/v1/user_points?user_id=eq." + enc(session.userId),
                session,
                "PATCH");
            patch.setRequestProperty("Content-Type", "application/json");
            patch.setRequestProperty("Prefer", "return=minimal");
            writeJson(patch, payload.toString());
            int code = patch.getResponseCode();
            readBody(patch, code);
            patch.disconnect();
            if (code < 200 || code >= 300) throw new Exception("points update failed");
        } else {
            payload.put("user_id", session.userId);
            payload.put("lifetime_points", amount);
            payload.put("current_points", 0);
            HttpURLConnection post = authed(NativeBalanceSession.SUPABASE_URL + "/rest/v1/user_points", session, "POST");
            post.setRequestProperty("Content-Type", "application/json");
            post.setRequestProperty("Prefer", "return=minimal");
            writeJson(post, payload.toString());
            int code = post.getResponseCode();
            readBody(post, code);
            post.disconnect();
            if (code < 200 || code >= 300) throw new Exception("points insert failed");
        }
    }

    private static HttpURLConnection authed(String url, NativeBalanceSession.Session session, String method) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setRequestMethod(method);
        conn.setRequestProperty("Accept", "application/json");
        conn.setRequestProperty("apikey", NativeBalanceSession.SUPABASE_ANON_KEY);
        conn.setRequestProperty("Authorization", "Bearer " + session.accessToken);
        conn.setConnectTimeout(15_000);
        conn.setReadTimeout(20_000);
        return conn;
    }

    private static void writeJson(HttpURLConnection conn, String json) throws Exception {
        conn.setDoOutput(true);
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        conn.setFixedLengthStreamingMode(bytes.length);
        try (OutputStream os = conn.getOutputStream()) {
            os.write(bytes);
        }
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

    private static String enc(String value) throws Exception {
        return URLEncoder.encode(value, "UTF-8");
    }

    private static final class Question {
        final String text;
        final String[] options;
        final int answerIndex;
        final String explanation;

        Question(String text, String[] options, int answerIndex) {
            this(text, options, answerIndex, "");
        }

        Question(String text, String[] options, int answerIndex, String explanation) {
            this.text = text;
            this.options = options;
            this.answerIndex = answerIndex;
            this.explanation = explanation == null ? "" : explanation;
        }
    }

    private static Question q(String text, String[] options, int answerIndex) {
        return new Question(text, options, answerIndex);
    }

    private static QuizSnapshot generatedSnapshot(int round) {
        String date = today();
        Question[] questions = new Question[Math.min(QUIZ_LENGTH, QUESTION_POOL.length)];
        for (int i = 0; i < questions.length; i++) {
            int poolIndex = positiveMod(date.hashCode() + (round * 11) + (i * 7), QUESTION_POOL.length);
            questions[i] = rotatedQuestion(QUESTION_POOL[poolIndex], date.hashCode() + (round * 13) + i);
        }
        return new QuizSnapshot("", date, "health-iq-" + date + "-" + round, "Health IQ Quiz", questions);
    }

    private static Question rotatedQuestion(Question base, int seed) {
        int optionCount = base.options.length;
        String[] options = new String[optionCount];
        int answerIndex = base.answerIndex;
        int rotation = positiveMod(seed, optionCount);
        for (int i = 0; i < optionCount; i++) {
            int sourceIndex = (i + rotation) % optionCount;
            options[i] = base.options[sourceIndex];
            if (sourceIndex == base.answerIndex) answerIndex = i;
        }
        return new Question(base.text, options, answerIndex, base.explanation);
    }

    private static int positiveMod(int value, int divisor) {
        int result = value % divisor;
        return result < 0 ? result + divisor : result;
    }

    private static final class QuizSnapshot {
        final String rawJson;
        final String date;
        final String lessonId;
        final String title;
        final Question[] questions;
        final String defaultHint;

        QuizSnapshot(String rawJson, String date, String lessonId, String title, Question[] questions) {
            this(rawJson, date, lessonId, title, questions, "");
        }

        QuizSnapshot(String rawJson, String date, String lessonId, String title, Question[] questions, String defaultHint) {
            this.rawJson = rawJson == null ? "" : rawJson;
            this.date = date == null || date.isEmpty() ? today() : date;
            this.lessonId = lessonId == null ? "" : lessonId;
            this.title = title == null || title.isEmpty() ? "Daily Quiz" : title;
            this.questions = questions == null ? new Question[0] : questions;
            this.defaultHint = defaultHint == null ? "" : defaultHint;
        }

        static QuizSnapshot load(Context context, int round) {
            if (round <= 0) {
                String raw = prefs(context).getString(SNAPSHOT_JSON_KEY, null);
                if (raw != null && !raw.isEmpty()) {
                    try {
                        QuizSnapshot snapshot = fromJson(raw);
                        if (today().equals(snapshot.date) && snapshot.hasQuestions()) return snapshot;
                    } catch (Exception ignored) { }
                }
            }
            return generatedSnapshot(Math.max(round, 0));
        }

        static QuizSnapshot fromJson(String raw) throws Exception {
            JSONObject json = new JSONObject(raw == null ? "{}" : raw);
            String date = json.optString("date", today());
            String lessonId = json.optString("lessonId", "");
            String title = json.optString("lessonTitle", "Daily Quiz");
            String defaultHint = json.optString("lessonHint", json.optString("hint", ""));
            JSONArray items = json.optJSONArray("questions");
            if (items == null) items = new JSONArray();

            Question[] questions = new Question[Math.min(items.length(), 8)];
            int count = 0;
            for (int i = 0; i < items.length() && count < 8; i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;
                JSONArray optionJson = item.optJSONArray("options");
                if (optionJson == null || optionJson.length() < 2) continue;

                int optionCount = Math.min(optionJson.length(), 4);
                String[] options = new String[optionCount];
                for (int j = 0; j < optionCount; j++) {
                    options[j] = optionJson.optString(j, "");
                }

                int answerIndex = item.optInt("answerIndex", -1);
                if (answerIndex < 0 || answerIndex >= optionCount) continue;

                String text = item.optString("question", "");
                if (text.isEmpty()) continue;

                String explanation = item.optString("explanation", item.optString("hint", ""));
                questions[count++] = new Question(text, options, answerIndex, explanation);
            }

            if (count != questions.length) {
                Question[] trimmed = new Question[count];
                System.arraycopy(questions, 0, trimmed, 0, count);
                questions = trimmed;
            }
            JSONObject normalized = new JSONObject(raw == null ? "{}" : raw);
            normalized.put("date", date);
            normalized.put("lessonId", lessonId);
            normalized.put("lessonHint", defaultHint);
            return new QuizSnapshot(normalized.toString(), date, lessonId, title, questions, defaultHint);
        }

        static QuizSnapshot empty() {
            return new QuizSnapshot("", today(), "", "Daily Quiz", new Question[0]);
        }

        boolean hasQuestions() {
            return questions.length > 0;
        }

        int length() {
            return questions.length;
        }

        Question questionAt(int index) {
            if (questions.length == 0) return new Question("Open Balance for fresh Health IQ lessons.", new String[] {"Open Balance"}, 0);
            int safeIndex = Math.min(Math.max(index, 0), questions.length - 1);
            return questions[safeIndex];
        }

        boolean matches(WidgetState state) {
            return date.equals(state.date) && lessonId.equals(state.snapshotId);
        }
    }

    private static final class WidgetState {
        final String date;
        final String snapshotId;
        final int round;
        int index;
        int score;
        boolean completed;
        String awardState;
        int feedbackChoice;
        boolean feedbackCorrect;
        boolean showingHint;

        WidgetState(String date, String snapshotId, int round, int index, int score, boolean completed, String awardState, int feedbackChoice, boolean feedbackCorrect, boolean showingHint) {
            this.date = date;
            this.snapshotId = snapshotId == null ? "" : snapshotId;
            this.round = Math.max(round, 0);
            this.index = index;
            this.score = score;
            this.completed = completed;
            this.awardState = awardState == null ? "" : awardState;
            this.feedbackChoice = feedbackChoice;
            this.feedbackCorrect = feedbackCorrect;
            this.showingHint = showingHint;
        }

        static WidgetState fresh(String date, String snapshotId, int round) {
            return new WidgetState(date, snapshotId, round, 0, 0, false, "", NO_CHOICE, false, false);
        }

        static WidgetState load(Context context, int appWidgetId) {
            SharedPreferences prefs = prefs(context);
            String prefix = key(appWidgetId, "");
            String date = prefs.getString(prefix + "date", today());
            int round = prefs.getInt(prefix + "round", 0);
            if (!today().equals(date)) {
                date = today();
                round = 0;
            }
            return new WidgetState(
                date,
                prefs.getString(prefix + "snapshot", ""),
                round,
                prefs.getInt(prefix + "index", 0),
                prefs.getInt(prefix + "score", 0),
                prefs.getBoolean(prefix + "completed", false),
                prefs.getString(prefix + "award", ""),
                prefs.getInt(prefix + "feedback_choice", NO_CHOICE),
                prefs.getBoolean(prefix + "feedback_correct", false),
                prefs.getBoolean(prefix + "showing_hint", false)
            );
        }

        void save(Context context, int appWidgetId) {
            String prefix = key(appWidgetId, "");
            prefs(context).edit()
                .putString(prefix + "date", date)
                .putString(prefix + "snapshot", snapshotId)
                .putInt(prefix + "round", round)
                .putInt(prefix + "index", index)
                .putInt(prefix + "score", score)
                .putBoolean(prefix + "completed", completed)
                .putString(prefix + "award", awardState)
                .putInt(prefix + "feedback_choice", feedbackChoice)
                .putBoolean(prefix + "feedback_correct", feedbackCorrect)
                .putBoolean(prefix + "showing_hint", showingHint)
                .apply();
        }

        boolean isShowingFeedback() {
            return feedbackChoice >= 0 && !showingHint;
        }

        boolean isShowingHint() {
            return feedbackChoice >= 0 && showingHint;
        }

        boolean isLocked() {
            return feedbackChoice >= 0;
        }

        void clearFeedback() {
            feedbackChoice = NO_CHOICE;
            feedbackCorrect = false;
            showingHint = false;
        }

        private static String key(int appWidgetId, String suffix) {
            return "w" + appWidgetId + "_" + suffix;
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }
}
