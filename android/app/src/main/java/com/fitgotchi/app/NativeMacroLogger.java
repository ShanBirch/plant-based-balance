package com.fitgotchi.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

final class NativeMacroLogger {
    private static final String PREFS_NAME = "quick_meal_prefs";
    private static final String KEY_PENDING = "pending_quick_meal";
    private static final String KEY_QUEUE = "pending_quick_meal_queue";

    private NativeMacroLogger() {}

    static void logManual(Context context, String name, int calories, double protein, double carbs, double fat, String mealType) throws Exception {
        if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return;
        String cleanName = name == null || name.trim().isEmpty() ? "Manual macros" : name.trim();
        String cleanMealType = mealType == null || mealType.trim().isEmpty() ? "snack" : mealType.trim();

        JSONObject totals = new JSONObject();
        totals.put("calories", calories);
        totals.put("protein_g", round1(protein));
        totals.put("carbs_g", round1(carbs));
        totals.put("fat_g", round1(fat));

        JSONObject item = new JSONObject();
        item.put("name", cleanName);
        item.put("portion", "manual entry");
        item.put("calories", calories);
        item.put("protein_g", round1(protein));
        item.put("carbs_g", round1(carbs));
        item.put("fat_g", round1(fat));

        JSONArray foodItems = new JSONArray();
        foodItems.put(item);

        JSONObject analysisResult = new JSONObject();
        analysisResult.put("foodItems", foodItems);
        analysisResult.put("totals", totals);
        analysisResult.put("confidence", "manual");
        analysisResult.put("notes", "Manual macro entry: " + cleanName);

        JSONObject pending = new JSONObject();
        pending.put("description", cleanName);
        pending.put("mealType", cleanMealType);
        pending.put("hasPhoto", false);
        pending.put("analysisResult", analysisResult.toString());
        pending.put("inputMethod", "manual");
        pending.put("timestamp", System.currentTimeMillis());

        appendToQueue(context, pending);
        CalorieTrackerWidgetProvider.addMealToSnapshot(context, calories, protein, carbs, fat);
    }

    private static void appendToQueue(Context context, JSONObject meal) throws Exception {
        SharedPreferences prefs = context.getApplicationContext()
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String existing = prefs.getString(KEY_QUEUE, null);
        JSONArray queue = existing != null && !existing.trim().isEmpty()
                ? new JSONArray(existing)
                : new JSONArray();
        queue.put(meal);
        prefs.edit()
                .putString(KEY_QUEUE, queue.toString())
                .putString(KEY_PENDING, meal.toString())
                .apply();
    }

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
