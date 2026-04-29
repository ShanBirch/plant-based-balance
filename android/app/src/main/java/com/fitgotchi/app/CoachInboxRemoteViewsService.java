package com.fitgotchi.app;

import android.content.Intent;
import android.widget.RemoteViewsService;

/**
 * Bridge between the system AppWidgetHost (launcher) and our
 * {@link CoachInboxRemoteViewsFactory}. The framework calls onGetViewFactory
 * each time a widget host needs to (re)bind its list adapter — we hand back
 * a fresh factory that knows how to fetch the coach feed and emit one
 * RemoteViews per row.
 *
 * Manifest:
 *   <service
 *       android:name=".CoachInboxRemoteViewsService"
 *       android:permission="android.permission.BIND_REMOTEVIEWS"
 *       android:exported="false" />
 *
 * The BIND_REMOTEVIEWS permission is the standard requirement — without it,
 * the launcher refuses to bind and the list silently shows the empty view.
 */
public class CoachInboxRemoteViewsService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new CoachInboxRemoteViewsFactory(getApplicationContext(), intent);
    }
}
