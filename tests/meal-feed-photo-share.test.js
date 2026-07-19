const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const trackerPath = path.join(__dirname, '..', 'js', 'dashboard', 'dashboard-script-11-calorie_tracker_functions.js');
const trackerSource = fs.readFileSync(trackerPath, 'utf8');
const dashboardSource = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');

function extractFunction(name, nextFunctionName) {
    const start = trackerSource.indexOf(`async function ${name}(`);
    assert.notEqual(start, -1, `${name} should exist`);
    const plainNext = trackerSource.indexOf(`\nfunction ${nextFunctionName}(`, start);
    const asyncNext = trackerSource.indexOf(`\nasync function ${nextFunctionName}(`, start);
    const next = [plainNext, asyncNext].filter(index => index >= 0).sort((a, b) => a - b)[0] ?? -1;
    assert.notEqual(next, -1, `${nextFunctionName} should follow ${name}`);
    return trackerSource.slice(start, next).trim();
}

test('dashboard loads the refreshed meal share logic', () => {
    assert.match(dashboardSource, /dashboard-script-11-calorie_tracker_functions\.js\?v=26/g);
});

test('meal Feed shares attach a missing photo before creating the story', async () => {
    let createdStoryData = null;
    let attachCalls = 0;
    const context = {
        window: {
            currentUser: { id: 'user-1' },
            dbHelpers: {
                stories: {
                    create: async (_userId, storyData) => {
                        createdStoryData = storyData;
                        return { id: 'story-1', points_awarded: 15 };
                    }
                }
            }
        },
        getMealSharePhotoUrl: meal => meal.photo_url || '',
        getMealCapturedPhotoFallback: () => null,
        clearMealCapturedPhotoFallback: () => {},
        pickMealFeedSharePhotoFile: async () => ({ type: 'image/jpeg' }),
        attachPhotoToMealForFeedShare: async meal => {
            attachCalls += 1;
            return { ...meal, photo_url: 'https://images.example/meal.jpg' };
        },
        getFreshMealRecordForFeedShare: async meal => meal,
        buildMealFeedCardPayload: meal => ({ photo_url: meal.photo_url }),
        isMealSharedToFeed: () => false,
        markMealSharedToFeed: () => {},
        markMealFeedShareUsedToday: () => {},
        loadPhotoFeed: () => {},
        showToast: () => {},
        console
    };

    vm.runInNewContext(
        `${extractFunction('shareMealRecordToFeed', 'getLatestMealFromRenderedListForFeedShare')}\nthis.shareMealRecordToFeed = shareMealRecordToFeed;`,
        context
    );

    const story = await context.shareMealRecordToFeed({ id: 'meal-1', meal_type: 'breakfast' }, null);
    assert.equal(attachCalls, 1);
    assert.equal(story.id, 'story-1');
    assert.equal(createdStoryData.media_url, 'https://images.example/meal.jpg');
    assert.equal(createdStoryData.thumbnail_url, 'https://images.example/meal.jpg');
});

test('meal Feed shares reuse the freshly saved camera photo without opening the gallery', async () => {
    let createdStoryData = null;
    let pickerCalls = 0;
    let attachCalls = 0;
    let refreshCalls = 0;
    const context = {
        window: {
            currentUser: { id: 'user-1' },
            dbHelpers: {
                stories: {
                    create: async (_userId, storyData) => {
                        createdStoryData = storyData;
                        return { id: 'story-1', points_awarded: 15 };
                    }
                }
            }
        },
        getMealSharePhotoUrl: meal => meal.photo_url || '',
        getMealCapturedPhotoFallback: () => null,
        clearMealCapturedPhotoFallback: () => {},
        pickMealFeedSharePhotoFile: async () => {
            pickerCalls += 1;
            return { type: 'image/jpeg' };
        },
        attachPhotoToMealForFeedShare: async meal => {
            attachCalls += 1;
            return meal;
        },
        getFreshMealRecordForFeedShare: async meal => {
            refreshCalls += 1;
            return { ...meal, photo_url: 'https://images.example/just-taken-meal.jpg' };
        },
        buildMealFeedCardPayload: meal => ({ photo_url: meal.photo_url }),
        isMealSharedToFeed: () => false,
        markMealSharedToFeed: () => {},
        markMealFeedShareUsedToday: () => {},
        loadPhotoFeed: () => {},
        showToast: () => {},
        console
    };

    vm.runInNewContext(
        `${extractFunction('shareMealRecordToFeed', 'getLatestMealFromRenderedListForFeedShare')}\nthis.shareMealRecordToFeed = shareMealRecordToFeed;`,
        context
    );

    const story = await context.shareMealRecordToFeed({ id: 'meal-1', meal_type: 'breakfast' }, null);
    assert.equal(story.id, 'story-1');
    assert.equal(refreshCalls, 2);
    assert.equal(pickerCalls, 0);
    assert.equal(attachCalls, 0);
    assert.equal(createdStoryData.media_url, 'https://images.example/just-taken-meal.jpg');
    assert.equal(createdStoryData.thumbnail_url, 'https://images.example/just-taken-meal.jpg');
});

test('meal Feed share retries the original captured photo instead of opening Android Photos', async () => {
    let createdStoryData = null;
    let pickerCalls = 0;
    let clearedFallback = false;
    const capturedFile = { type: 'image/jpeg', name: 'captured-meal.jpg' };
    const context = {
        window: {
            currentUser: { id: 'user-1' },
            dbHelpers: {
                stories: {
                    create: async (_userId, storyData) => {
                        createdStoryData = storyData;
                        return { id: 'story-1', points_awarded: 15 };
                    }
                }
            }
        },
        getMealSharePhotoUrl: meal => meal.photo_url || '',
        getMealCapturedPhotoFallback: () => capturedFile,
        clearMealCapturedPhotoFallback: () => { clearedFallback = true; },
        pickMealFeedSharePhotoFile: async () => {
            pickerCalls += 1;
            return { type: 'image/jpeg' };
        },
        attachPhotoToMealForFeedShare: async (meal, file) => {
            assert.equal(file, capturedFile);
            return { ...meal, photo_url: 'https://images.example/retried-captured-meal.jpg' };
        },
        getFreshMealRecordForFeedShare: async meal => meal,
        buildMealFeedCardPayload: meal => ({ photo_url: meal.photo_url }),
        isMealSharedToFeed: () => false,
        markMealSharedToFeed: () => {},
        markMealFeedShareUsedToday: () => {},
        loadPhotoFeed: () => {},
        showToast: () => {},
        console,
        Error
    };

    vm.runInNewContext(
        `${extractFunction('shareMealRecordToFeed', 'getLatestMealFromRenderedListForFeedShare')}\nthis.shareMealRecordToFeed = shareMealRecordToFeed;`,
        context
    );

    const story = await context.shareMealRecordToFeed({ id: 'meal-1', meal_type: 'breakfast' }, null);
    assert.equal(story.id, 'story-1');
    assert.equal(pickerCalls, 0);
    assert.equal(clearedFallback, true);
    assert.equal(createdStoryData.media_url, 'https://images.example/retried-captured-meal.jpg');
});

test('the chosen share photo is uploaded and persisted on the meal', async () => {
    let updatedValues = null;
    const query = {
        update(values) {
            updatedValues = values;
            return this;
        },
        eq() { return this; },
        select() { return this; },
        async maybeSingle() {
            return { data: { id: 'meal-1', ...updatedValues }, error: null };
        }
    };
    const context = {
        window: {
            currentUser: { id: 'user-1' },
            supabaseClient: { from: table => {
                assert.equal(table, 'meal_logs');
                return query;
            } }
        },
        compressMealImage: async file => ({ ...file, compressed: true }),
        uploadMealPhoto: async file => {
            assert.equal(file.compressed, true);
            return 'https://images.example/meal.jpg';
        },
        Error
    };

    vm.runInNewContext(
        `${extractFunction('attachPhotoToMealForFeedShare', 'shareMealRecordToFeed')}\nthis.attachPhotoToMealForFeedShare = attachPhotoToMealForFeedShare;`,
        context
    );

    const meal = await context.attachPhotoToMealForFeedShare(
        { id: 'meal-1' },
        { type: 'image/jpeg' }
    );
    assert.equal(updatedValues.photo_url, 'https://images.example/meal.jpg');
    assert.equal(updatedValues.storage_path, 'https://images.example/meal.jpg');
    assert.equal(meal.photo_url, 'https://images.example/meal.jpg');
    assert.equal(meal.media_url, 'https://images.example/meal.jpg');
});
