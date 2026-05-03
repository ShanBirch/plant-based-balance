package com.fitgotchi.app;

import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebSettings;
import android.webkit.WebView;

import java.net.InetAddress;

/**
 * Warms the Android WebView stack while native shortcut UI is already visible.
 * This keeps the shortcut popup quick, then shaves work off the following
 * MainActivity cold start when the user opens a web-backed destination.
 */
final class AndroidLaunchWarmup {
    private static final String BASE_URL = "https://plantbased-balance.org/";
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static WebView warmWebView;
    private static long lastWarmupAtMs;

    private AndroidLaunchWarmup() {}

    static void prewarm(Context context) {
        if (context == null) return;
        if (Looper.myLooper() != Looper.getMainLooper()) {
            MAIN.post(() -> prewarm(context));
            return;
        }

        long now = android.os.SystemClock.elapsedRealtime();
        if (warmWebView != null || now - lastWarmupAtMs < 120_000) {
            return;
        }
        lastWarmupAtMs = now;

        try {
            Context appContext = context.getApplicationContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WebView.startSafeBrowsing(appContext, null);
            }

            warmWebView = new WebView(appContext);
            WebSettings settings = warmWebView.getSettings();
            settings.setDomStorageEnabled(true);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setJavaScriptEnabled(false);
            warmWebView.loadDataWithBaseURL(
                    BASE_URL,
                    "<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>",
                    "text/html",
                    "UTF-8",
                    null);
            MAIN.postDelayed(AndroidLaunchWarmup::release, 10_000);
        } catch (Throwable ignored) {
            warmWebView = null;
        }

        new Thread(() -> {
            try {
                InetAddress.getByName("plantbased-balance.org");
            } catch (Exception ignored) { }
        }, "balance-dns-warmup").start();
    }

    static void release() {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            MAIN.post(AndroidLaunchWarmup::release);
            return;
        }
        if (warmWebView == null) return;
        try {
            warmWebView.stopLoading();
            warmWebView.destroy();
        } catch (Throwable ignored) { }
        warmWebView = null;
    }
}
