package com.fitgotchi.app;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.InstallSourceInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * ScreenTimePlugin
 *
 * Exposes Android's UsageStatsManager to the web layer via Capacitor.
 * Requires the PACKAGE_USAGE_STATS permission — a special "Usage Access"
 * permission that the user must grant manually in system settings.
 *
 * Usage flow:
 *   1. Call hasPermission() — if false, show explanation then call requestPermission()
 *   2. requestPermission() opens Settings > Apps > Special app access > Usage access
 *   3. User toggles the app on, returns to the app
 *   4. Call getTodayUsage() to get today's screen time + per-app breakdown
 *   5. Optionally call getDayUsage({ date: "YYYY-MM-DD" }) for a past day
 */
@CapacitorPlugin(name = "ScreenTime")
public class ScreenTimePlugin extends Plugin {

    // ── Permission helpers ────────────────────────────────────────────────────

    /**
     * Check whether Usage Access has been granted.
     * Returns: { granted: boolean }
     */
    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", isUsageAccessGranted());
        call.resolve(result);
    }

    /**
     * Open the system Usage Access settings screen so the user can grant permission.
     * Returns: { opened: boolean }
     */
    @PluginMethod
    public void requestPermission(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not open usage access settings: " + e.getMessage());
        }
    }

    /**
     * Returns info about the install source and Android version so the JS layer
     * can detect whether the "Restricted Settings" workaround is needed.
     *
     * On Android 13+ (API 33), sideloaded apps (installed outside the Play Store)
     * have sensitive permissions like Usage Access blocked by default. The user must
     * go to App Info → "Allow restricted settings" before they can grant Usage Access.
     *
     * Returns: { sdkVersion: int, isSideloaded: boolean, needsRestrictedUnlock: boolean }
     */
    @PluginMethod
    public void getInstallInfo(PluginCall call) {
        JSObject result = new JSObject();
        int sdk = Build.VERSION.SDK_INT;
        result.put("sdkVersion", sdk);

        boolean sideloaded = isSideloaded();
        result.put("isSideloaded", sideloaded);

        // Restricted Settings only applies on Android 13+ for sideloaded apps
        result.put("needsRestrictedUnlock", sdk >= 33 && sideloaded);

        call.resolve(result);
    }

    /**
     * Open this app's system App Info page (Settings > Apps > Balance).
     * This is where the user can find "Allow restricted settings" on Android 13+.
     * Returns: { opened: boolean }
     */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not open app settings: " + e.getMessage());
        }
    }

    // ── Data methods ──────────────────────────────────────────────────────────

    /**
     * Get usage stats for today (midnight → now).
     * Returns: { totalScreenTimeMinutes: int, apps: Array<AppUsage> }
     * where AppUsage = { app_name, package_name, category, minutes }
     */
    @PluginMethod
    public void getTodayUsage(PluginCall call) {
        if (!isUsageAccessGranted()) {
            call.reject("USAGE_ACCESS_NOT_GRANTED");
            return;
        }

        Calendar start = Calendar.getInstance();
        start.set(Calendar.HOUR_OF_DAY, 0);
        start.set(Calendar.MINUTE, 0);
        start.set(Calendar.SECOND, 0);
        start.set(Calendar.MILLISECOND, 0);

        queryUsageForRange(call, start.getTimeInMillis(), System.currentTimeMillis());
    }

    /**
     * Get usage stats for a specific past date.
     * Params: { date: "YYYY-MM-DD" }
     * Returns: same shape as getTodayUsage
     */
    @PluginMethod
    public void getDayUsage(PluginCall call) {
        if (!isUsageAccessGranted()) {
            call.reject("USAGE_ACCESS_NOT_GRANTED");
            return;
        }

        String dateStr = call.getString("date");
        if (dateStr == null) {
            call.reject("Missing 'date' parameter (expected YYYY-MM-DD)");
            return;
        }

        try {
            String[] parts = dateStr.split("-");
            int year  = Integer.parseInt(parts[0]);
            int month = Integer.parseInt(parts[1]) - 1; // Calendar is 0-indexed
            int day   = Integer.parseInt(parts[2]);

            Calendar start = Calendar.getInstance();
            start.set(year, month, day, 0, 0, 0);
            start.set(Calendar.MILLISECOND, 0);

            Calendar end = Calendar.getInstance();
            end.set(year, month, day, 23, 59, 59);
            end.set(Calendar.MILLISECOND, 999);

            queryUsageForRange(call, start.getTimeInMillis(), end.getTimeInMillis());
        } catch (Exception e) {
            call.reject("Invalid date format (expected YYYY-MM-DD): " + e.getMessage());
        }
    }

    // ── Core query logic ──────────────────────────────────────────────────────

    private void queryUsageForRange(PluginCall call, long startMs, long endMs) {
        UsageStatsManager usm = (UsageStatsManager) getContext()
                .getSystemService(Context.USAGE_STATS_SERVICE);

        if (usm == null) {
            call.reject("UsageStatsManager not available on this device");
            return;
        }

        List<UsageStats> stats = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY, startMs, endMs);

        if (stats == null || stats.isEmpty()) {
            // Return zeros — data may just not be available yet (e.g. early in the day)
            JSObject result = new JSObject();
            result.put("totalScreenTimeMinutes", 0);
            result.put("apps", new JSArray());
            call.resolve(result);
            return;
        }

        PackageManager pm = getContext().getPackageManager();
        long totalMs = 0;

        // Build a list of user-visible apps with meaningful usage
        List<JSObject> appList = new ArrayList<>();

        for (UsageStats stat : stats) {
            long timeMs = stat.getTotalTimeInForeground();
            if (timeMs < 60_000) continue; // Skip anything under 1 minute

            String pkg = stat.getPackageName();

            // Skip our own app
            if (pkg.equals(getContext().getPackageName())) continue;

            // Only include user-launchable apps (filters out most system internals)
            if (!isUserLaunchableApp(pm, pkg)) continue;

            totalMs += timeMs;

            int minutes = (int) (timeMs / 60_000);
            String appName = getAppLabel(pm, pkg);
            String category = categorizePackage(pkg);

            try {
                JSObject appObj = new JSObject();
                appObj.put("app_name", appName);
                appObj.put("package_name", pkg);
                appObj.put("category", category);
                appObj.put("minutes", minutes);
                appList.add(appObj);
            } catch (Exception ignored) {
                // Skip this entry
            }
        }

        // Sort descending by minutes so the JS side gets the top apps first
        Collections.sort(appList, (a, b) -> {
            int ma = a.optInt("minutes", 0);
            int mb = b.optInt("minutes", 0);
            return Integer.compare(mb, ma);
        });

        JSArray appsArray = new JSArray();
        for (JSObject app : appList) {
            appsArray.put(app);
        }

        JSObject result = new JSObject();
        result.put("totalScreenTimeMinutes", (int) (totalMs / 60_000));
        result.put("apps", appsArray);
        call.resolve(result);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private boolean isUsageAccessGranted() {
        try {
            AppOpsManager appOps = (AppOpsManager) getContext()
                    .getSystemService(Context.APP_OPS_SERVICE);
            if (appOps == null) return false;
            int mode = appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    getContext().getPackageName());
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Detect whether this app was installed from a source other than the
     * Google Play Store (i.e. sideloaded via APK).
     */
    private boolean isSideloaded() {
        try {
            PackageManager pm = getContext().getPackageManager();
            String pkg = getContext().getPackageName();

            if (Build.VERSION.SDK_INT >= 30) {
                // API 30+ provides structured install source info
                InstallSourceInfo source = pm.getInstallSourceInfo(pkg);
                String installer = source.getInstallingPackageName();
                return !isKnownStore(installer);
            } else {
                // Fallback for older APIs
                String installer = pm.getInstallerPackageName(pkg);
                return !isKnownStore(installer);
            }
        } catch (Exception e) {
            // If we can't determine the installer, assume sideloaded to be safe
            return true;
        }
    }

    private boolean isKnownStore(String installer) {
        if (installer == null) return false;
        return installer.equals("com.android.vending")        // Google Play Store
            || installer.equals("com.google.android.packageinstaller")
            || installer.equals("com.amazon.venezia")          // Amazon Appstore
            || installer.equals("com.sec.android.app.samsungapps"); // Samsung Galaxy Store
    }

    private boolean isUserLaunchableApp(PackageManager pm, String pkg) {
        // An app is "user-visible" if it has a launcher intent
        return pm.getLaunchIntentForPackage(pkg) != null;
    }

    private String getAppLabel(PackageManager pm, String pkg) {
        try {
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            CharSequence label = pm.getApplicationLabel(info);
            return label != null ? label.toString() : pkg;
        } catch (PackageManager.NameNotFoundException e) {
            return pkg;
        }
    }

    // ── App category mapping ──────────────────────────────────────────────────

    private static final Map<String, String> KNOWN_PACKAGES = new HashMap<String, String>() {{
        // Social
        put("com.instagram.android",          "social");
        put("com.facebook.katana",            "social");
        put("com.twitter.android",            "social");
        put("com.twitter.android.lite",       "social");
        put("com.zhiliaoapp.musically",       "social"); // TikTok
        put("com.ss.android.ugc.trill",       "social"); // TikTok (some regions)
        put("com.snapchat.android",           "social");
        put("com.pinterest",                  "social");
        put("com.linkedin.android",           "social");
        put("com.reddit.frontpage",           "social");
        put("com.tumblr",                     "social");
        put("com.bereal.android",             "social");
        put("com.threads.instagram",          "social");

        // Entertainment
        put("com.netflix.mediaclient",              "entertainment");
        put("com.google.android.youtube",           "entertainment");
        put("com.amazon.avod.thirdpartyclient",     "entertainment");
        put("com.disney.disneyplus",                "entertainment");
        put("com.spotify.music",                    "entertainment");
        put("com.google.android.apps.youtube.music","entertainment");
        put("com.audible.application",              "entertainment");
        put("com.twitch.android.app",               "entertainment");
        put("tv.plex.labs.plex",                    "entertainment");
        put("com.max.android",                      "entertainment");
        put("com.apple.android.music",              "entertainment");
        put("com.soundcloud.android",               "entertainment");
        put("com.pandora.android",                  "entertainment");

        // Communication
        put("com.whatsapp",                         "communication");
        put("com.facebook.orca",                    "communication");
        put("org.telegram.messenger",               "communication");
        put("com.discord",                          "communication");
        put("com.google.android.apps.messaging",    "communication");
        put("com.google.android.gm",                "communication");
        put("com.microsoft.teams",                  "communication");
        put("com.slack",                            "communication");
        put("com.skype.raider",                     "communication");
        put("com.viber.voip",                       "communication");
        put("kik.android",                          "communication");
        put("jp.naver.line.android",                "communication");
        put("com.signal.android",                   "communication");
        put("com.microsoft.outlook",                "communication");

        // Productivity
        put("com.google.android.calendar",          "productivity");
        put("com.google.android.apps.docs",         "productivity");
        put("com.google.android.apps.sheets",       "productivity");
        put("com.google.android.keep",              "productivity");
        put("com.microsoft.office.word",            "productivity");
        put("com.microsoft.office.excel",           "productivity");
        put("com.todoist",                          "productivity");
        put("com.evernote",                         "productivity");
        put("com.notion.id",                        "productivity");
        put("com.ticktick.task",                    "productivity");
        put("com.google.android.apps.tasks",        "productivity");

        // Health & Fitness
        put("com.fitbit.FitbitMobile",              "health");
        put("com.myfitnesspal.android",             "health");
        put("com.nike.plusgps",                     "health");
        put("com.strava",                           "health");
        put("com.google.android.apps.fitness",      "health");
        put("com.samsung.android.shealth",          "health");
        put("com.whoop.android",                    "health");
        put("org.plantbasedbalance.fitgotchi",      "health");
        put("com.fitgotchi.app",                    "health");
        put("com.calm.android",                     "health");
        put("com.headspace.android",                "health");
        put("com.noom.app",                         "health");

        // Games
        put("com.king.candycrushsaga",              "games");
        put("com.supercell.clashofclans",           "games");
        put("com.pubg.imobile",                     "games");
        put("com.roblox.client",                    "games");
        put("com.mojang.minecraftpe",               "games");
        put("com.supercell.brawlstars",             "games");
        put("com.supercell.clashroyale",            "games");
        put("com.tencent.ig",                       "games");
        put("com.activision.callofduty.shooter",    "games");
        put("com.ea.game.nfs14_row",                "games");
    }};

    private String categorizePackage(String pkg) {
        String known = KNOWN_PACKAGES.get(pkg);
        if (known != null) return known;

        // Keyword heuristics on the package name
        String lower = pkg.toLowerCase();
        if (lower.contains("game") || lower.contains(".puzzle") || lower.contains(".arcade")
                || lower.contains(".rpg") || lower.contains("casino")) return "games";
        if (lower.contains("fitness") || lower.contains("health") || lower.contains("workout")
                || lower.contains("yoga") || lower.contains("meditation")) return "health";
        if (lower.contains("music") || lower.contains("video") || lower.contains("movie")
                || lower.contains("stream") || lower.contains("podcast")) return "entertainment";
        if (lower.contains("mail") || lower.contains(".chat") || lower.contains("message")
                || lower.contains("messenger") || lower.contains("meet")) return "communication";
        if (lower.contains("social") || lower.contains("photo")) return "social";
        if (lower.contains("office") || lower.contains(".docs") || lower.contains("note")
                || lower.contains("task") || lower.contains("calendar")) return "productivity";
        return "other";
    }
}
