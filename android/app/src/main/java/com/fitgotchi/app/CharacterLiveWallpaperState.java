package com.fitgotchi.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

final class CharacterLiveWallpaperState {
    static final String PREFS_NAME = "character_live_wallpaper";
    static final String KEY_MODEL_SRC = "model_src";
    static final String KEY_LEVEL = "level";
    static final String KEY_RANK = "rank";
    static final String KEY_COLORS = "colors";
    static final String KEY_ACTIVE_RARE_SKIN = "active_rare_skin";
    static final String KEY_UPDATED_AT = "updated_at";
    static final String ACTION_STATE_CHANGED = "com.fitgotchi.app.ACTION_CHARACTER_WALLPAPER_CHANGED";

    static final String DEFAULT_MODEL_SRC =
            "https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb";
    static final String DEFAULT_COLORS =
            "{\"hair\":\"#4a3728\",\"shirt\":\"#7BA883\",\"pants\":\"#2C3E50\",\"shoes\":\"#1a202c\",\"skin\":\"#DEB887\"}";

    private CharacterLiveWallpaperState() {}

    static void save(Context context, String json) {
        if (context == null || json == null || json.trim().isEmpty()) return;
        try {
            save(context, new JSONObject(json));
        } catch (Exception ignored) {}
    }

    static void save(Context context, JSONObject payload) {
        if (context == null || payload == null) return;
        try {
            String src = payload.optString("src", "").trim();
            if (src.isEmpty()) return;

            Object colorsValue = payload.opt("colors");
            String colors = DEFAULT_COLORS;
            if (colorsValue instanceof JSONObject) {
                colors = colorsValue.toString();
            } else if (colorsValue instanceof String && !((String) colorsValue).trim().isEmpty()) {
                colors = (String) colorsValue;
            }

            SharedPreferences.Editor editor = prefs(context).edit()
                    .putString(KEY_MODEL_SRC, src)
                    .putString(KEY_LEVEL, payload.optString("level", "1"))
                    .putString(KEY_RANK, payload.optString("rank", ""))
                    .putString(KEY_COLORS, colors)
                    .putString(KEY_ACTIVE_RARE_SKIN, payload.optString("activeRareSkin", ""))
                    .putLong(KEY_UPDATED_AT, payload.optLong("updatedAt", System.currentTimeMillis()));
            editor.apply();

            context.sendBroadcast(new android.content.Intent(ACTION_STATE_CHANGED)
                    .setPackage(context.getPackageName()));
        } catch (Exception ignored) {}
    }

    static State read(Context context) {
        SharedPreferences prefs = prefs(context);
        return new State(
                prefs.getString(KEY_MODEL_SRC, DEFAULT_MODEL_SRC),
                prefs.getString(KEY_LEVEL, "1"),
                prefs.getString(KEY_RANK, ""),
                prefs.getString(KEY_COLORS, DEFAULT_COLORS),
                prefs.getString(KEY_ACTIVE_RARE_SKIN, ""),
                prefs.getLong(KEY_UPDATED_AT, 0L));
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    static final class State {
        final String modelSrc;
        final String level;
        final String rank;
        final String colorsJson;
        final String activeRareSkin;
        final long updatedAt;

        State(String modelSrc, String level, String rank, String colorsJson, String activeRareSkin, long updatedAt) {
            this.modelSrc = modelSrc == null || modelSrc.trim().isEmpty() ? DEFAULT_MODEL_SRC : modelSrc;
            this.level = level == null ? "1" : level;
            this.rank = rank == null ? "" : rank;
            this.colorsJson = colorsJson == null || colorsJson.trim().isEmpty() ? DEFAULT_COLORS : colorsJson;
            this.activeRareSkin = activeRareSkin == null ? "" : activeRareSkin;
            this.updatedAt = updatedAt;
        }
    }
}
