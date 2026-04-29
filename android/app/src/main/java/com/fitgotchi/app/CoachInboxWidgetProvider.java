package com.fitgotchi.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import android.view.View;
import android.widget.RemoteViews;

/**
 * Home-screen widget that shows the coach's pending + scheduled drafts at a
 * glance. Augments the lock-screen notification system with a persistent
 * surface for batch triage:
 *   - Lock-screen notification = action a single draft in one tap, no unlock
 *   - This widget = scan all queued drafts in one place after unlock
 *
 * The list is backed by {@link CoachInboxRemoteViewsService}, which fetches
 * the coach's feed from /.netlify/functions/widget-coach-feed using the
 * device's FCM token as the auth primitive (server resolves token -> user).
 *
 * Refresh model:
 *   - No automatic system update (updatePeriodMillis=0 in widget_info.xml).
 *     System-driven refreshes are rate-limited to 30min minimum, which is
 *     too slow for a coach-facing inbox.
 *   - Event-driven via {@link #ACTION_REFRESH} broadcast, fired from:
 *       1. CoachDraftMessagingService when a new draft FCM arrives
 *       2. CoachReplyWorker after a successful send
 *       3. The widget's own refresh button
 *   - Tap the inbox area or the chevron header to launch MainActivity at
 *     the alerts tab for richer triage.
 *
 * Manifest: see AndroidManifest.xml — receiver + service registrations
 * sit next to CoachDraftMessagingService.
 */
public class CoachInboxWidgetProvider extends AppWidgetProvider {

    private static final String TAG = "CoachInboxWidget";

    /** Action this widget listens for to trigger a refresh. */
    public static final String ACTION_REFRESH =
            "com.fitgotchi.app.ACTION_COACH_INBOX_REFRESH";

    /** Action fired when the user taps the manual refresh button. */
    private static final String ACTION_REFRESH_TAP =
            "com.fitgotchi.app.ACTION_COACH_INBOX_REFRESH_TAP";

    /**
     * Called from app-side hooks (messaging service, reply worker) when the
     * inbox state has materially changed. Fires the refresh broadcast so any
     * installed widgets re-pull their feed.
     */
    public static void requestRefresh(Context context) {
        Intent intent = new Intent(context, CoachInboxWidgetProvider.class);
        intent.setAction(ACTION_REFRESH);
        context.sendBroadcast(intent);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, mgr, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        final String action = intent == null ? null : intent.getAction();
        if (ACTION_REFRESH.equals(action) || ACTION_REFRESH_TAP.equals(action)) {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            int[] ids = mgr.getAppWidgetIds(
                    new android.content.ComponentName(context, CoachInboxWidgetProvider.class));
            if (ids != null && ids.length > 0) {
                // notifyAppWidgetViewDataChanged forces the RemoteViewsFactory
                // to re-run onDataSetChanged, which is where we re-fetch the
                // feed. Cheaper than full updateWidget(), which would also
                // rebuild the static chrome.
                mgr.notifyAppWidgetViewDataChanged(ids, R.id.widget_inbox_list);
                Log.d(TAG, "refresh for " + ids.length + " widget(s)");
            }
        }
    }

    private void updateWidget(Context context, AppWidgetManager mgr, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_coach_inbox);

        // List adapter — points at our RemoteViewsService which fetches and
        // hydrates the per-row views.
        Intent svcIntent = new Intent(context, CoachInboxRemoteViewsService.class);
        svcIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        // Unique data URI per widget instance so multiple placements don't
        // share a stale list. Standard pattern from the Android docs.
        svcIntent.setData(Uri.parse(svcIntent.toUri(Intent.URI_INTENT_SCHEME)));
        views.setRemoteAdapter(R.id.widget_inbox_list, svcIntent);
        views.setEmptyView(R.id.widget_inbox_list, R.id.widget_inbox_empty);

        // Header tap -> open MainActivity (which routes to the alerts tab in
        // the WebView). Chevron icon lives in the header layout.
        Intent openAppIntent = new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra("open_alerts_tab", true);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent openAppPi = PendingIntent.getActivity(
                context, appWidgetId, openAppIntent, piFlags);
        views.setOnClickPendingIntent(R.id.widget_inbox_header, openAppPi);

        // Manual refresh button -> our own refresh broadcast.
        Intent refreshIntent = new Intent(context, CoachInboxWidgetProvider.class)
                .setAction(ACTION_REFRESH_TAP);
        PendingIntent refreshPi = PendingIntent.getBroadcast(
                context,
                appWidgetId + 1_000_000,
                refreshIntent,
                piFlags);
        views.setOnClickPendingIntent(R.id.widget_inbox_refresh, refreshPi);

        // Per-row tap template: each row's setOnClickFillInIntent provides
        // a partial intent that's merged with this template at click time.
        // The template also opens MainActivity; the per-row fillInIntent
        // adds the specific alertId so the dashboard can deep-link into
        // the alert if it wants to in the future.
        Intent rowTemplate = new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra("open_alerts_tab", true);
        // Activity-template PendingIntents need to be MUTABLE on API 31+ so
        // the per-row fillInIntent can attach extras. (FCM rule of "must be
        // immutable" doesn't apply here.)
        int rowTplFlags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
        PendingIntent rowTemplatePi = PendingIntent.getActivity(
                context, appWidgetId + 2_000_000, rowTemplate, rowTplFlags);
        views.setPendingIntentTemplate(R.id.widget_inbox_list, rowTemplatePi);

        // Tap the empty-state text -> also opens the alerts tab so an
        // empty-but-curious tap still lands somewhere useful.
        views.setOnClickPendingIntent(R.id.widget_inbox_empty, openAppPi);

        // Hide the spinner initially; the factory re-shows it during refresh
        // by setting visibility on this view via RemoteViews calls in the
        // service. (Keep simple: always hidden in the static layout.)
        views.setViewVisibility(R.id.widget_inbox_loading, View.GONE);

        mgr.updateAppWidget(appWidgetId, views);
    }
}
