# Calorie Tracker Setup Guide

## Overview

The Calorie Tracker feature allows users to log meals by taking photos, which are automatically analyzed using Google Gemini AI to estimate calories, macronutrients, and micronutrients. The feature integrates seamlessly into both the main dashboard and meals section.

## Features

- 📸 **Photo-based meal logging** - Take a photo, get instant nutrition analysis
- 🤖 **AI-powered analysis** - Uses Google Gemini 1.5 Flash to identify foods and estimate nutrition
- 📊 **Progress tracking** - Visual progress bars for calories and macros
- 🎯 **Daily goals** - Track your nutrition against customizable daily goals
- 📱 **Mobile-first design** - Clean, responsive interface optimized for mobile devices

## Database Setup

### 1. Run the Migration

Execute the SQL migration in your Supabase SQL Editor:

```bash
# The migration file is located at:
database/calorie-tracker-migration.sql
```

This will create:
- `meal_logs` table - Stores individual meal photos and AI analysis
- `daily_nutrition` table - Stores aggregated daily nutrition totals
- Automated triggers to update daily totals when meals are added/updated/deleted
- Row-level security policies

### 2. Create Storage Bucket

In Supabase Storage dashboard:

1. Create a new bucket named `meal-photos`
2. Set it to **private** (not public)
3. Add storage policies (already included in the migration SQL comments):

```sql
-- Allow users to upload their own meal photos
CREATE POLICY "Users can upload own meal photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to view their own meal photos
CREATE POLICY "Users can view own meal photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own meal photos
CREATE POLICY "Users can delete own meal photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## API Setup

### Google Gemini API Key

The feature uses the existing `GEMINI_API_KEY` environment variable in Netlify. No additional setup needed if you already have this configured for the Shannon AI coach.

If not configured:
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key for Gemini API
3. Add to Netlify environment variables:
   - Variable: `GEMINI_API_KEY`
   - Value: Your API key

## Features by Location

### Dashboard (Main View)

The dashboard shows a compact calorie widget with:
- Current calories vs daily goal
- Progress bar for calories
- Three macro progress indicators (Protein, Carbs, Fat)
- Quick camera button to log meals
- "View Details" link to full tracker

### Meals Section (Full Tracker)

The full tracker includes:
- Large circular calorie progress indicator
- Detailed progress bars for all macros (Protein, Carbs, Fat, Fiber)
- Current values and goals for each macro
- Camera button to log new meals
- List of today's logged meals with photos
- Ability to delete individual meals

## User Flow

1. **Take Photo**: User clicks camera button (on dashboard or in meals section)
2. **Camera Opens**: Native camera or file picker opens
3. **Photo Selected**: User takes/selects a photo of their meal
4. **AI Analysis**: Photo is sent to Gemini API for analysis
5. **Upload**: Photo is uploaded to Supabase Storage
6. **Save**: Meal log and nutrition data saved to database
7. **Update**: UI updates with new totals and progress bars
8. **View**: Meal appears in the meal log list

## Nutrition Analysis

The AI analyzes photos and returns:

### Macronutrients
- Calories (kcal)
- Protein (g)
- Carbohydrates (g)
- Fat (g)
- Fiber (g)

### Micronutrients (when significant)
- Vitamin C (mg)
- Iron (mg)
- Calcium (mg)
- Potassium (mg)

### Additional Data
- Food items detected with portion sizes
- Confidence level (high/medium/low)
- Analysis notes and caveats

## Default Goals

The feature uses sensible defaults that can be customized:

- **Calories**: 2000 kcal/day
- **Protein**: 50g/day
- **Carbs**: 250g/day
- **Fat**: 70g/day
- **Fiber**: 25g/day

Goals are stored in the `daily_nutrition` table and can be customized per user.

## Customization

### Adjusting Daily Goals

Users can customize their daily goals by updating the `daily_nutrition` table:

```sql
UPDATE daily_nutrition
SET
  calorie_goal = 2200,
  protein_goal_g = 60,
  carbs_goal_g = 275,
  fat_goal_g = 75
WHERE user_id = '<user-id>' AND nutrition_date = CURRENT_DATE;
```

### Styling

All calorie tracker styles are in `dashboard.html` under the `/* CALORIE TRACKER STYLES */` section. Key CSS variables used:

- `var(--primary)` - Main green color for progress
- `var(--primary-light)` - Lighter green for gradients
- `var(--secondary)` - Gold/yellow accent
- `var(--text-main)` - Main text color
- `var(--text-muted)` - Muted text color
- `var(--accent-green)` - Light green background

## API Endpoints

### `/netlify/functions/analyze-food`

**Method**: POST

**Request Body**:
```json
{
  "imageBase64": "base64-encoded-image-data",
  "mimeType": "image/jpeg"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "foodItems": [
      {
        "name": "Grilled Chicken Breast",
        "portion": "6 oz",
        "calories": 280,
        "protein_g": 53,
        "carbs_g": 0,
        "fat_g": 6,
        "fiber_g": 0
      }
    ],
    "totals": {
      "calories": 280,
      "protein_g": 53,
      "carbs_g": 0,
      "fat_g": 6,
      "fiber_g": 0
    },
    "micronutrients": {
      "iron_mg": 1.5,
      "potassium_mg": 450
    },
    "confidence": "high",
    "notes": "Well-lit image, clear portion size"
  }
}
```

## Database Schema

### meal_logs Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users |
| meal_date | DATE | Date of meal |
| meal_time | TIME | Time of meal |
| photo_url | TEXT | URL to photo in Supabase Storage |
| storage_path | TEXT | Storage path in bucket |
| food_items | JSONB | Array of detected food items |
| calories | NUMERIC | Total calories |
| protein_g | NUMERIC | Protein in grams |
| carbs_g | NUMERIC | Carbs in grams |
| fat_g | NUMERIC | Fat in grams |
| fiber_g | NUMERIC | Fiber in grams |
| micronutrients | JSONB | Micronutrient data |
| notes | TEXT | AI analysis notes |
| ai_confidence | TEXT | Confidence level |
| analysis_timestamp | TIMESTAMPTZ | When analyzed |
| created_at | TIMESTAMPTZ | Record creation |
| updated_at | TIMESTAMPTZ | Last update |

### daily_nutrition Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users |
| nutrition_date | DATE | Date of nutrition data |
| total_calories | NUMERIC | Total calories for day |
| total_protein_g | NUMERIC | Total protein for day |
| total_carbs_g | NUMERIC | Total carbs for day |
| total_fat_g | NUMERIC | Total fat for day |
| total_fiber_g | NUMERIC | Total fiber for day |
| meal_count | INTEGER | Number of meals logged |
| calorie_goal | NUMERIC | Daily calorie goal |
| protein_goal_g | NUMERIC | Daily protein goal |
| carbs_goal_g | NUMERIC | Daily carbs goal |
| fat_goal_g | NUMERIC | Daily fat goal |
| created_at | TIMESTAMPTZ | Record creation |
| updated_at | TIMESTAMPTZ | Last update |

## Key Functions

### JavaScript Functions (dashboard.html)

- `openMealCamera(source)` - Opens camera/file picker
- `handleMealPhotoSelect(event)` - Handles photo selection and analysis
- `uploadMealPhoto(file)` - Uploads to Supabase Storage
- `saveMealLog(mealData)` - Saves to database
- `loadTodayNutrition()` - Loads today's nutrition data
- `updateNutritionUI(dailyData, mealsData)` - Updates all UI elements
- `renderMealsList(meals)` - Renders meal log list
- `deleteMealLog(mealId)` - Deletes a meal

## Testing

### Manual Testing Checklist

1. ✅ Take a photo from dashboard camera button
2. ✅ Take a photo from meals section camera button
3. ✅ Verify photo uploads to Supabase Storage
4. ✅ Verify AI analysis completes
5. ✅ Verify meal log saves to database
6. ✅ Verify daily totals update correctly
7. ✅ Verify progress bars update
8. ✅ Verify meal appears in meal list
9. ✅ Delete a meal and verify totals recalculate
10. ✅ Test on mobile device

## Troubleshooting

### Photo Upload Fails

- Check Supabase Storage bucket exists and is named `meal-photos`
- Verify storage policies are created correctly
- Check browser console for errors

### AI Analysis Fails

- Verify `GEMINI_API_KEY` is set in Netlify environment variables
- Check edge function logs in Netlify
- Ensure image is valid format (JPEG, PNG)

### Database Errors

- Verify migration was run successfully
- Check RLS policies are enabled
- Verify user is authenticated

### UI Not Updating

- Check browser console for JavaScript errors
- Verify `loadTodayNutrition()` is being called
- Check if data is being returned from database queries

## Future Enhancements

Potential improvements for future iterations:

1. **Manual Entry** - Allow users to manually log meals if photo analysis isn't accurate
2. **Edit Meals** - Allow editing of nutrition values after analysis
3. **Meal Types** - Tag meals as breakfast, lunch, dinner, snack
4. **Weekly/Monthly Views** - Show nutrition trends over time
5. **Export Data** - Export nutrition data as CSV or PDF
6. **Barcode Scanner** - Scan packaged food barcodes for accurate nutrition
7. **Recipe Database** - Save and reuse common meals
8. **Goal Recommendations** - AI-powered goal suggestions based on profile

## Support

For issues or questions:
- Check Supabase logs for database errors
- Check Netlify function logs for API errors
- Review browser console for client-side errors

---

Built with ❤️ for Plant-Based Balance
