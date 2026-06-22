const assert = require('assert');

const { _test } = require('../netlify/functions/instagram-webhook');
const { _test: foodTrackTest } = require('../netlify/functions/ig-food-photo-track-background');
const { normalizeMetaIgWebhookEvents } = require('../netlify/functions/_lib/meta-ig-context');

const text = _test.messageTextForDraft({
    igAccountId: '17841400000000000',
    item: {
        sender: { id: '978239761327698' },
        recipient: { id: '17841400000000000' },
        message: {
            reply_to: {
                story: {
                    id: '18000011122233344',
                    url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/story.jpg',
                },
            },
            text: 'Good tip, I follow less vegan foodies now',
        },
    },
});

assert.ok(text.includes('replied to your story (story media attached)'));
assert.ok(text.includes('Good tip, I follow less vegan foodies now'));
assert.ok(!text.includes('[PHOTO:'));

const foodPhotoUrl = 'https://lookaside.fbsbx.com/ig_messaging_cdn/meal.jpg';
const foodPhotoEvent = {
    igAccountId: '17841400000000000',
    item: {
        sender: { id: '978239761327698', username: 'fra' },
        recipient: { id: '17841400000000000' },
        message: {
            mid: 'meal-photo-in',
            attachments: [{ type: 'image', payload: { url: foodPhotoUrl } }],
        },
    },
};
const foodPhotoText = _test.messageTextForDraft(foodPhotoEvent);
assert.ok(foodPhotoText.includes(`[PHOTO:${foodPhotoUrl}]`));
assert.deepStrictEqual(_test.extractFoodPhotoUrls(foodPhotoText), [foodPhotoUrl]);
assert.deepStrictEqual(_test.foodPhotoUrlsFromMessaging(foodPhotoEvent), [foodPhotoUrl]);
assert.deepStrictEqual(_test.foodPhotoUrlsFromMessaging({
    igAccountId: '17841400000000000',
    item: {
        sender: { id: '978239761327698' },
        recipient: { id: '17841400000000000' },
        message: {
            mid: 'story-mention-in',
            attachments: [{ type: 'story_mention', payload: { url: foodPhotoUrl } }],
        },
    },
}), []);

assert.strictEqual(
    _test.foodTrackingIdentityTokens({ linked_user_id: 'client-1', profile_name: 'Fra Smith' }).includes('fra'),
    true
);
assert.strictEqual(
    _test.isFoodPhotoTrackingAllowed({ linked_user_id: 'client-1', profile_name: 'Fra Smith', custom_data: {} }),
    true
);
assert.strictEqual(
    _test.isFoodPhotoTrackingAllowed({ linked_user_id: 'client-2', profile_name: 'Romy', custom_data: {} }),
    true
);
assert.strictEqual(
    _test.isFoodPhotoTrackingAllowed({ linked_user_id: null, profile_name: 'Fra', custom_data: {} }),
    false
);
assert.strictEqual(
    _test.isFoodPhotoTrackingAllowed({ linked_user_id: 'client-3', profile_name: 'Someone Else', custom_data: {} }),
    false
);
assert.strictEqual(
    _test.isFoodPhotoTrackingAllowed({ linked_user_id: 'client-4', profile_name: 'Someone Else', custom_data: { food_photo_tracking: { enabled: true } } }),
    true
);
assert.strictEqual(
    _test.isFoodPhotoTrackingAllowed({ linked_user_id: 'client-5', profile_name: 'Fra', custom_data: { food_photo_tracking: { enabled: false } } }),
    false
);
assert.strictEqual(
    _test.isFoodPhotoTrackingOfferText("hey send me your meals and I'll log it for you"),
    true
);
assert.strictEqual(
    _test.isFoodPhotoTrackingOfferText("send me a photo if dinner looks good"),
    false
);
assert.strictEqual(_test.isFoodPhotoTrackingConsentText('yeah sounds good'), true);
assert.strictEqual(_test.isFoodPhotoTrackingConsentText('nah not now'), false);
assert.strictEqual(
    _test.foodPhotoTrackingOfferIsActive({
        food_photo_tracking: {
            offer_status: 'pending',
            last_offer_at: '2026-06-22T00:00:00.000Z',
        },
    }, '2026-06-23T00:00:00.000Z'),
    true
);
assert.strictEqual(
    _test.hasPendingFoodPhotoTrackingOffer({
        linked_user_id: 'client-6',
        custom_data: {
            food_photo_tracking: {
                offer_status: 'pending',
                last_offer_at: '2026-06-22T00:00:00.000Z',
            },
        },
    }, '2026-06-23T00:00:00.000Z'),
    true
);
assert.strictEqual(
    _test.hasPendingFoodPhotoTrackingOffer({
        linked_user_id: 'client-7',
        custom_data: {
            food_photo_tracking: {
                offer_status: 'accepted',
                last_offer_at: '2026-06-22T00:00:00.000Z',
            },
        },
    }, '2026-06-23T00:00:00.000Z'),
    false
);

const brisbaneLunch = foodTrackTest.brisbaneDateParts(new Date('2026-06-22T02:34:56Z'));
assert.strictEqual(brisbaneLunch.mealDate, '2026-06-22');
assert.strictEqual(brisbaneLunch.mealTime, '12:34:56');
assert.strictEqual(foodTrackTest.mealTypeForHour(brisbaneLunch.hour), 'lunch');
assert.deepStrictEqual(foodTrackTest.nutritionTotals({
    foodItems: [
        { calories: 100, protein_g: 10, carbs_g: 5, fat_g: 4, fiber_g: 2 },
        { calories: 50, protein_g: 3, carbs_g: 8, fat_g: 1, fiber_g: 1 },
    ],
}), { calories: 150, protein_g: 13, carbs_g: 13, fat_g: 5, fiber_g: 3 });
assert.strictEqual(foodTrackTest.jobTokenMatches({
    custom_data: { food_photo_tracking: { pending_job_tokens: ['queued-token'] } },
}, 'queued-token'), true);
assert.strictEqual(foodTrackTest.jobTokenMatches({
    custom_data: { food_photo_tracking: { pending_job_tokens: ['queued-token'] } },
}, 'other-token'), false);

const outbound = _test.messageTextForDraft({
    field: 'message_echoes',
    igAccountId: '17841400000000000',
    item: {
        sender: { id: '17841400000000000' },
        recipient: { id: '978239761327698' },
        message: {
            is_echo: true,
            reply_to: {
                story: {
                    id: '18000011122233345',
                    url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/their-story.jpg',
                },
            },
            text: 'Ooooh I dunno about that! How was it?',
        },
    },
});

assert.ok(outbound.includes('replied to their story (story media attached)'));
assert.ok(!outbound.includes('replied to your story'));
assert.ok(outbound.includes('Ooooh I dunno about that! How was it?'));

const outboundEvents = normalizeMetaIgWebhookEvents({
    object: 'instagram',
    entry: [{
        id: '17841400000000000',
        messaging: [{
            sender: { id: '17841400000000000' },
            recipient: { id: '978239761327698' },
            timestamp: 1778223722476,
            message: {
                mid: 'outbound-story-echo',
                is_echo: true,
                reply_to: { story: { id: '18000011122233345' } },
                text: 'Ooooh I dunno about that! How was it?',
            },
        }],
    }],
});

assert.strictEqual(outboundEvents[0].direction, 'out');
assert.strictEqual(_test.shouldProcessContentContextEvent(outboundEvents[0]), false);
assert.strictEqual(_test.participantUsernameFromMessaging({
    igAccountId: '17841400000000000',
    item: {
        sender: { id: '978239761327698', username: 'plant_lead' },
        recipient: { id: '17841400000000000' },
        message: { mid: 'direct-in', text: 'hey' },
    },
}, '978239761327698', 'in'), 'plant_lead');
assert.strictEqual(_test.participantUsernameFromMessaging({
    igAccountId: '17841400000000000',
    item: {
        sender: { id: '17841400000000000', username: 'cocos_pt_studio' },
        recipient: { id: '978239761327698', username: 'plant_lead' },
        message: { mid: 'direct-out', text: 'hey', is_echo: true },
    },
}, '978239761327698', 'out'), 'plant_lead');

console.log('instagram webhook story media tests passed');
