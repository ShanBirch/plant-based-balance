package com.fitgotchi.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
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
    private static final String ACTION_ASK_BALANCE_ROUTE = "com.fitgotchi.app.ACTION_ASK_BALANCE_ROUTE";
    private static final String EXTRA_ASK_BALANCE_TARGET = "balance_target";
    private static final String EXTRA_WIDGET_ID = "widget_id";
    private static final String EXTRA_CHOICE = "choice";

    private static final String PREFS_NAME = "daily_quiz_widget_prefs";
    private static final int QUIZ_LENGTH = 8;
    private static final int PERFECT_XP = 5;

    private static final Question[] QUESTION_POOL = new Question[] {
        q("For plant protein, what matters most across the day?",
            new String[] {"Total protein", "Only dinner", "Avoid legumes", "Zero carbs"}, 0),
        q("Tap the FIRST step for a habit that actually sticks.",
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
            new String[] {"Same pose/light", "Random angles", "Zoomed mirror", "Dark room"}, 0),
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
            WidgetState.fresh(context, appWidgetId).save(context, appWidgetId);
            updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
            return;
        }

        if (ACTION_ANSWER.equals(action)) {
            int choice = intent.getIntExtra(EXTRA_CHOICE, -1);
            WidgetState state = WidgetState.load(context, appWidgetId);
            if (!today().equals(state.date)) state = WidgetState.fresh(context, appWidgetId);
            if (state.completed || choice < 0) {
                updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
                return;
            }

            Question question = questionFor(state.date, state.index);
            if (choice == question.answerIndex) state.score++;
            state.index++;
            if (state.index >= QUIZ_LENGTH) {
                state.completed = true;
                if (state.score == QUIZ_LENGTH) state.awardState = "pending";
            }
            state.save(context, appWidgetId);
            updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
            if (state.completed && "pending".equals(state.awardState)) {
                syncPerfectScore(context, appWidgetId, goAsync());
            }
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        WidgetState state = WidgetState.load(context, appWidgetId);
        if (!today().equals(state.date)) {
            state = WidgetState.fresh(context, appWidgetId);
            state.save(context, appWidgetId);
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_daily_quiz);
        views.setTextViewText(R.id.widget_daily_quiz_progress, progressText(state));

        if (state.completed) {
            renderComplete(context, views, appWidgetId, state);
        } else {
            renderQuestion(context, views, appWidgetId, state);
        }

        manager.updateAppWidget(appWidgetId, views);
    }

    private static void renderQuestion(Context context, RemoteViews views, int appWidgetId, WidgetState state) {
        Question question = questionFor(state.date, state.index);
        views.setTextViewText(R.id.widget_daily_quiz_title, "Daily Quiz");
        views.setTextViewText(R.id.widget_daily_quiz_question, question.text);
        views.setViewVisibility(R.id.widget_daily_quiz_restart, View.GONE);
        views.setViewVisibility(R.id.widget_daily_quiz_option_1, View.VISIBLE);
        views.setViewVisibility(R.id.widget_daily_quiz_option_2, View.VISIBLE);
        views.setViewVisibility(R.id.widget_daily_quiz_option_3, View.VISIBLE);
        views.setViewVisibility(R.id.widget_daily_quiz_option_4, View.VISIBLE);

        int[] ids = optionIds();
        for (int i = 0; i < ids.length; i++) {
            views.setTextViewText(ids[i], question.options[i]);
            views.setOnClickPendingIntent(ids[i], answerIntent(context, appWidgetId, i));
        }
    }

    private static void renderComplete(Context context, RemoteViews views, int appWidgetId, WidgetState state) {
        boolean perfect = state.score == QUIZ_LENGTH;
        views.setTextViewText(R.id.widget_daily_quiz_title, perfect ? "Perfect" : "Good Try");
        views.setTextViewText(R.id.widget_daily_quiz_question, completionText(state));
        views.setTextViewText(R.id.widget_daily_quiz_option_1, "Restart");
        views.setTextViewText(R.id.widget_daily_quiz_option_2, "Open app");
        views.setViewVisibility(R.id.widget_daily_quiz_option_1, View.VISIBLE);
        views.setViewVisibility(R.id.widget_daily_quiz_option_2, View.VISIBLE);
        views.setViewVisibility(R.id.widget_daily_quiz_option_3, View.GONE);
        views.setViewVisibility(R.id.widget_daily_quiz_option_4, View.GONE);
        views.setViewVisibility(R.id.widget_daily_quiz_restart, View.GONE);
        views.setOnClickPendingIntent(R.id.widget_daily_quiz_option_1, restartIntent(context, appWidgetId));
        views.setOnClickPendingIntent(R.id.widget_daily_quiz_option_2, openAppIntent(context, appWidgetId + 5000));
    }

    private static String completionText(WidgetState state) {
        if (state.score < QUIZ_LENGTH) return state.score + "/" + QUIZ_LENGTH + " correct. Tap Restart and go again.";
        String perfectScore = QUIZ_LENGTH + "/" + QUIZ_LENGTH + " correct. ";
        if ("awarded".equals(state.awardState)) return perfectScore + "+5 XP synced.";
        if ("signin".equals(state.awardState)) return perfectScore + "Open Balance once to sync XP.";
        if ("error".equals(state.awardState)) return perfectScore + "Open Balance to sync XP.";
        return perfectScore + "Syncing +5 XP...";
    }

    private static String progressText(WidgetState state) {
        if (state.completed) return state.score + "/" + QUIZ_LENGTH;
        return (state.index + 1) + "/" + QUIZ_LENGTH;
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

    private static Question questionFor(String date, int index) {
        Question base = QUESTION_POOL[positiveMod(date.hashCode() + (index * 7), QUESTION_POOL.length)];
        String[] options = new String[base.options.length];
        int answerIndex = base.answerIndex;
        int rotation = positiveMod((date.hashCode() / 7) + index, base.options.length);
        for (int i = 0; i < base.options.length; i++) {
            int sourceIndex = (i + rotation) % base.options.length;
            options[i] = base.options[sourceIndex];
            if (sourceIndex == base.answerIndex) answerIndex = i;
        }
        return new Question(base.text, options, answerIndex);
    }

    private static Question q(String text, String[] options, int answerIndex) {
        return new Question(text, options, answerIndex);
    }

    private static int positiveMod(int value, int divisor) {
        int result = value % divisor;
        return result < 0 ? result + divisor : result;
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
                    state.awardState = "awarded";
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

        Question(String text, String[] options, int answerIndex) {
            this.text = text;
            this.options = options;
            this.answerIndex = answerIndex;
        }
    }

    private static final class WidgetState {
        final String date;
        int index;
        int score;
        boolean completed;
        String awardState;

        WidgetState(String date, int index, int score, boolean completed, String awardState) {
            this.date = date;
            this.index = index;
            this.score = score;
            this.completed = completed;
            this.awardState = awardState == null ? "" : awardState;
        }

        static WidgetState fresh(Context context, int appWidgetId) {
            return new WidgetState(today(), 0, 0, false, "");
        }

        static WidgetState load(Context context, int appWidgetId) {
            SharedPreferences prefs = prefs(context);
            String prefix = key(appWidgetId, "");
            String date = prefs.getString(prefix + "date", today());
            return new WidgetState(
                date,
                prefs.getInt(prefix + "index", 0),
                prefs.getInt(prefix + "score", 0),
                prefs.getBoolean(prefix + "completed", false),
                prefs.getString(prefix + "award", "")
            );
        }

        void save(Context context, int appWidgetId) {
            String prefix = key(appWidgetId, "");
            prefs(context).edit()
                .putString(prefix + "date", date)
                .putInt(prefix + "index", index)
                .putInt(prefix + "score", score)
                .putBoolean(prefix + "completed", completed)
                .putString(prefix + "award", awardState)
                .apply();
        }

        private static SharedPreferences prefs(Context context) {
            return context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        }

        private static String key(int appWidgetId, String suffix) {
            return "w" + appWidgetId + "_" + suffix;
        }
    }
}
