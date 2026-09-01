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

function addMealOverlayShareStubs(context) {
    context.window.pbbShareImageUrlToDataUrl = async () => 'data:image/jpeg;base64,bWVhbA==';
    context.window.renderBalanceShareCardImage = async () => 'data:image/jpeg;base64,b3ZlcmxheQ==';
    context.atob = value => Buffer.from(value, 'base64').toString('binary');
    context.Uint8Array = Uint8Array;
    context.File = class File {
        constructor(parts, name, options) {
            this.parts = parts;
            this.name = name;
            this.type = options.type;
        }
    };
    context.FormData = class FormData {
        constructor() { this.values = new Map(); }
        append(key, value) { this.values.set(key, value); }
    };
    context.crypto = { randomUUID: () => 'overlay-story-id' };
    context.fetch = async () => ({
        ok: true,
        json: async () => ({ url: 'https://images.example/rendered-meal-overlay.jpg' })
    });
    context.mealShareFileFromDataUrl = (_dataUrl, fileName) => ({
        name: fileName,
        type: 'image/jpeg'
    });
    context.uploadStoryMediaToBackblaze = async (_file, options) => {
        assert.equal(options.source, 'meal_share_photo_overlay');
        assert.equal(options.preferDirectUpload, true);
        return { url: 'https://images.example/rendered-meal-overlay.jpg' };
    };
}

test('dashboard loads the refreshed meal share logic', () => {
    assert.match(dashboardSource, /dashboard-script-11-calorie_tracker_functions\.js\?v=40-meal-complete-share/g);
});

test('meal share prompt stays visible and locks every action while its photo uploads', () => {
    assert.match(trackerSource, /function setMealFeedSharePromptBusy\(isBusy, statusText\)/);
    assert.match(trackerSource, /prompt\.querySelectorAll\('button'\)\.forEach\(button =>/);
    assert.match(trackerSource, /button\.disabled = !!isBusy/);
    assert.match(trackerSource, /data-meal-share-progress/);
    assert.match(trackerSource, /pbbMealShareProgress 1\.15s linear infinite/);
    assert.match(trackerSource, /if \(prompt && prompt\.dataset\.busy === 'true' && force !== true\) return/);
    assert.match(trackerSource, /if \(isBusy && prompt\._dismissTimer\)/);
    assert.match(trackerSource, /setMealFeedSharePromptBusy\(true, 'Uploading photo and preparing your Feed post\.\.\.'\)/);
});

test('Instagram meal shares collect a photo and send the designed photo-backed card', async () => {
    let pickerCalls = 0;
    let attachedFile = null;
    let instagramCall = null;
    const selectedFile = { type: 'image/jpeg', name: 'finished-meal.jpg' };
    const context = {
        window: {
            currentUser: { id: 'user-1' },
            shareBalanceCardToInstagram: async (payload, target, options) => {
                instagramCall = { payload, target, options };
                return true;
            },
            awardBalanceSocialShareXP: async () => ({ success: true })
        },
        getFreshMealRecordForFeedShare: async meal => meal,
        getMealSharePhotoUrl: meal => meal.photo_url || '',
        getMealCapturedPhotoFallback: () => null,
        clearMealCapturedPhotoFallback: () => {},
        pickMealFeedSharePhotoFile: async () => {
            pickerCalls += 1;
            return selectedFile;
        },
        attachPhotoToMealForFeedShare: async (meal, file) => {
            attachedFile = file;
            return { ...meal, photo_url: 'https://images.example/finished-meal.jpg' };
        },
        buildMealFeedCardPayload: meal => ({
            card_type: 'meal',
            photo_url: meal.photo_url,
            calories: 612,
            protein: 38,
            carbs: 74,
            fat: 19
        }),
        getMealInstagramPhotoDataUrl: async payload => payload.photo_url ? 'data:image/jpeg;base64,meal' : '',
        markMealInstagramShareUsedToday: () => {},
        getMealInstagramShareButtonText: () => 'IG Feed',
        showToast: () => {},
        console
    };
    addMealOverlayShareStubs(context);

    vm.runInNewContext(
        `${extractFunction('shareMealRecordToInstagram', 'closeMealFeedSharePrompt')}\nthis.shareMealRecordToInstagram = shareMealRecordToInstagram;`,
        context
    );

    const opened = await context.shareMealRecordToInstagram(
        { id: 'meal-1', meal_type: 'dinner' },
        null,
        'feed'
    );

    assert.equal(opened, true);
    assert.equal(pickerCalls, 1);
    assert.equal(attachedFile, selectedFile);
    assert.equal(instagramCall.target, 'feed');
    assert.equal(instagramCall.payload.card_type, 'meal');
    assert.equal(instagramCall.payload.photo_url, 'https://images.example/finished-meal.jpg');
    assert.equal(instagramCall.options.photoDataUrl, 'data:image/jpeg;base64,meal');
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
    addMealOverlayShareStubs(context);

    vm.runInNewContext(
        `${extractFunction('shareMealRecordToFeed', 'getLatestMealFromRenderedListForFeedShare')}\nthis.shareMealRecordToFeed = shareMealRecordToFeed;`,
        context
    );

    const story = await context.shareMealRecordToFeed({ id: 'meal-1', meal_type: 'breakfast' }, null);
    assert.equal(attachCalls, 1);
    assert.equal(story.id, 'story-1');
    assert.equal(createdStoryData.media_url, 'https://images.example/rendered-meal-overlay.jpg');
    assert.equal(createdStoryData.thumbnail_url, 'https://images.example/rendered-meal-overlay.jpg');
    assert.equal(JSON.parse(createdStoryData.caption).share_style, 'photo_overlay');
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
    addMealOverlayShareStubs(context);

    vm.runInNewContext(
        `${extractFunction('shareMealRecordToFeed', 'getLatestMealFromRenderedListForFeedShare')}\nthis.shareMealRecordToFeed = shareMealRecordToFeed;`,
        context
    );

    const story = await context.shareMealRecordToFeed({ id: 'meal-1', meal_type: 'breakfast' }, null);
    assert.equal(story.id, 'story-1');
    assert.equal(refreshCalls, 2);
    assert.equal(pickerCalls, 0);
    assert.equal(attachCalls, 0);
    assert.equal(createdStoryData.media_url, 'https://images.example/rendered-meal-overlay.jpg');
    assert.equal(createdStoryData.thumbnail_url, 'https://images.example/rendered-meal-overlay.jpg');
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
    addMealOverlayShareStubs(context);

    vm.runInNewContext(
        `${extractFunction('shareMealRecordToFeed', 'getLatestMealFromRenderedListForFeedShare')}\nthis.shareMealRecordToFeed = shareMealRecordToFeed;`,
        context
    );

    const story = await context.shareMealRecordToFeed({ id: 'meal-1', meal_type: 'breakfast' }, null);
    assert.equal(story.id, 'story-1');
    assert.equal(pickerCalls, 0);
    assert.equal(clearedFallback, true);
    assert.equal(createdStoryData.media_url, 'https://images.example/rendered-meal-overlay.jpg');
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
