// ==========================================
// MEAL BUILDER FEATURE
// ------------------------------------------
// Lets users compose a meal from multiple items (via photo AI analysis
// or text description), save it to user_saved_meals, and re-log it
// quickly from the "Saved" tab of the Recent Meals modal.
//
// This module intentionally reuses the existing analyze-food and
// analyze-meal-text endpoints so the AI analysis stays in one place.
// ==========================================

(function () {
    'use strict';

    // Internal builder state — reset each time the modal opens
    var builderState = {
        items: [],            // [{ name, portion, calories, protein_g, carbs_g, fat_g, fiber_g, micronutrients }]
        totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
        micronutrients: {},
        isAdding: false       // true while an AI analysis is in-flight
    };

    // Expose so debugging / tests can poke at it
    window._builderState = builderState;

    // True when we've temporarily dropped the builder modal down to reveal
    // the camera. Tracked so we can slide it back up on any camera-close
    // path (successful capture, barcode scan, cancel, native finish).
    var _builderHiddenForCamera = false;

    // ─────────────────────────────────────────────
    // Modal open / close
    // ─────────────────────────────────────────────

    window.openMealBuilder = function () {
        resetBuilderState();
        var modal = document.getElementById('meal-builder-modal');
        if (modal) {
            modal.classList.add('visible');
            modal.classList.remove('hidden-for-camera');
        }
        _builderHiddenForCamera = false;
        // Focus the name input on next tick so the keyboard (on mobile) can pop
        setTimeout(function () {
            var nameEl = document.getElementById('meal-builder-name');
            if (nameEl) nameEl.focus();
        }, 250);
    };

    window.closeMealBuilder = function () {
        var modal = document.getElementById('meal-builder-modal');
        if (modal) {
            modal.classList.remove('visible');
            modal.classList.remove('hidden-for-camera');
        }
        _builderHiddenForCamera = false;
        closeBuilderTextInput();
        cancelBuilderPortionPrompt();
    };

    // Slide the meal builder modal down off-screen so the camera view is
    // unobstructed. Safe to call when the builder isn't visible — it's a
    // no-op in that case. Paired with showBuilderAfterCamera() below.
    function hideBuilderForCamera() {
        var modal = document.getElementById('meal-builder-modal');
        if (!modal || !modal.classList.contains('visible')) return;
        modal.classList.add('hidden-for-camera');
        _builderHiddenForCamera = true;
    }

    // Slide the meal builder modal back up, but only if we were the ones
    // that hid it for a camera capture. Other code paths (e.g. the user
    // explicitly closing the builder) leave this flag false, so this
    // won't accidentally re-open a closed builder.
    function showBuilderAfterCamera() {
        if (!_builderHiddenForCamera) return;
        _builderHiddenForCamera = false;
        var modal = document.getElementById('meal-builder-modal');
        if (modal) modal.classList.remove('hidden-for-camera');
    }

    // Expose so the unified camera / iOS file-input path can call it
    // directly when the camera closes.
    window._showBuilderAfterCamera = showBuilderAfterCamera;
    window._hideBuilderForCamera = hideBuilderForCamera;

    function resetBuilderState() {
        builderState.items = [];
        builderState.totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
        builderState.micronutrients = {};
        builderState.isAdding = false;
        var nameEl = document.getElementById('meal-builder-name');
        if (nameEl) nameEl.value = '';
        renderBuilder();
    }

    // ─────────────────────────────────────────────
    // Rendering
    // ─────────────────────────────────────────────

    function renderBuilder() {
        renderBuilderItems();
        renderBuilderTotals();
        updateSaveButtonState();
    }

    function renderBuilderItems() {
        var list = document.getElementById('meal-builder-items');
        if (!list) return;

        if (builderState.items.length === 0) {
            list.innerHTML =
                '<div class="meal-builder-empty" id="meal-builder-empty">' +
                '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
                '<circle cx="12" cy="12" r="10"></circle>' +
                '<line x1="12" y1="8" x2="12" y2="16"></line>' +
                '<line x1="8" y1="12" x2="16" y2="12"></line>' +
                '</svg>' +
                '<p>No items yet.<br><span style="font-size:0.8rem;">Add items below to build your meal.</span></p>' +
                '</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < builderState.items.length; i++) {
            var item = builderState.items[i];
            var cal = Math.round(item.calories || 0);
            var p = Math.round(item.protein_g || 0);
            var c = Math.round(item.carbs_g || 0);
            var f = Math.round(item.fat_g || 0);
            var portion = item.portion ? escapeHtml(String(item.portion)) + ' · ' : '';

            html +=
                '<div class="meal-builder-item">' +
                '<div class="meal-builder-item-info">' +
                '<div class="meal-builder-item-name">' + escapeHtml(item.name || 'Item') + '</div>' +
                '<div class="meal-builder-item-meta">' + portion + cal + ' cal · P ' + p + 'g · C ' + c + 'g · F ' + f + 'g</div>' +
                '</div>' +
                '<button class="meal-builder-item-remove" onclick="removeBuilderItem(' + i + ')" aria-label="Remove item">&times;</button>' +
                '</div>';
        }
        list.innerHTML = html;
    }

    function renderBuilderTotals() {
        var t = builderState.totals;
        setText('meal-builder-total-cal', Math.round(t.calories || 0));
        setText('meal-builder-total-p', Math.round(t.protein_g || 0));
        setText('meal-builder-total-c', Math.round(t.carbs_g || 0));
        setText('meal-builder-total-f', Math.round(t.fat_g || 0));
    }

    function updateSaveButtonState() {
        var btn = document.getElementById('meal-builder-save-btn');
        if (!btn) return;
        var ready = builderState.items.length > 0 && !builderState.isAdding;
        btn.disabled = !ready;
    }

    // ─────────────────────────────────────────────
    // Totals recalculation
    // ─────────────────────────────────────────────

    function recalcTotals() {
        var totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
        var micros = {};
        for (var i = 0; i < builderState.items.length; i++) {
            var it = builderState.items[i];
            totals.calories += parseFloat(it.calories) || 0;
            totals.protein_g += parseFloat(it.protein_g) || 0;
            totals.carbs_g += parseFloat(it.carbs_g) || 0;
            totals.fat_g += parseFloat(it.fat_g) || 0;
            totals.fiber_g += parseFloat(it.fiber_g) || 0;
            if (it.micronutrients) {
                for (var k in it.micronutrients) {
                    if (!Object.prototype.hasOwnProperty.call(it.micronutrients, k)) continue;
                    micros[k] = (micros[k] || 0) + (parseFloat(it.micronutrients[k]) || 0);
                }
            }
        }
        builderState.totals = totals;
        builderState.micronutrients = micros;
    }

    // ─────────────────────────────────────────────
    // Item add / remove
    // ─────────────────────────────────────────────

    // Given an AI analysis response (same shape as analyze-food / analyze-meal-text),
    // merge every detected food item into the builder as a separate entry and
    // attach any micronutrient totals to the first merged item (so aggregation
    // on save still produces a correct total).
    function mergeAnalysisIntoBuilder(nutritionData) {
        if (!nutritionData || !Array.isArray(nutritionData.foodItems) || nutritionData.foodItems.length === 0) {
            throw new Error('No food items detected');
        }

        var micros = nutritionData.micronutrients || {};
        var attachedMicros = false;

        for (var i = 0; i < nutritionData.foodItems.length; i++) {
            var fi = nutritionData.foodItems[i];
            var item = {
                name: fi.name || 'Item',
                portion: fi.portion || '',
                portion_weight_g: fi.portion_weight_g || null,
                calories: parseFloat(fi.calories) || 0,
                protein_g: parseFloat(fi.protein_g) || 0,
                carbs_g: parseFloat(fi.carbs_g) || 0,
                fat_g: parseFloat(fi.fat_g) || 0,
                fiber_g: parseFloat(fi.fiber_g) || 0,
                micronutrients: !attachedMicros ? micros : {}
            };
            attachedMicros = true;
            builderState.items.push(item);
        }

        recalcTotals();
        renderBuilder();
    }

    window.removeBuilderItem = function (index) {
        if (index < 0 || index >= builderState.items.length) return;
        builderState.items.splice(index, 1);
        recalcTotals();
        renderBuilder();
    };

    // ─────────────────────────────────────────────
    // Add via PHOTO — reuses analyze-food endpoint
    // ─────────────────────────────────────────────

    // Callback shared by the unified camera and the file-input fallback.
    // Restores the dropped-down builder modal and hands the captured
    // photo to the portion prompt flow, which asks the user how much
    // they had before sending the photo off to Gemini for analysis.
    function handleBuilderPhotoFile(file) {
        showBuilderAfterCamera();
        if (!file || !file.type || !file.type.startsWith('image/')) {
            showBuilderToast('No photo captured.', 'error');
            return;
        }
        promptForPortionThenAnalyze(file);
    }

    // Holds the captured photo while we wait for the user to type in a
    // portion size in the portion-prompt modal. Cleared on submit/cancel.
    var _pendingPortionPhoto = null;
    var _pendingPortionPreviewUrl = null;

    function promptForPortionThenAnalyze(file) {
        _pendingPortionPhoto = file;

        var modal = document.getElementById('meal-builder-portion-modal');
        var input = document.getElementById('meal-builder-portion-input');
        var preview = document.getElementById('meal-builder-portion-preview');
        var submit = document.getElementById('meal-builder-portion-submit');

        if (preview) {
            if (_pendingPortionPreviewUrl) {
                try { URL.revokeObjectURL(_pendingPortionPreviewUrl); } catch (e) {}
            }
            try {
                _pendingPortionPreviewUrl = URL.createObjectURL(file);
                preview.src = _pendingPortionPreviewUrl;
                preview.style.display = 'block';
            } catch (e) {
                preview.style.display = 'none';
            }
        }

        if (input) {
            input.value = '';
            input.disabled = false;
        }
        if (submit) {
            submit.disabled = true;
            submit.textContent = 'Analyze & Add';
        }
        if (modal) modal.classList.add('visible');
        setTimeout(function () { if (input) input.focus(); }, 180);
    }

    window.cancelBuilderPortionPrompt = function () {
        _pendingPortionPhoto = null;
        var preview = document.getElementById('meal-builder-portion-preview');
        if (preview) preview.style.display = 'none';
        if (_pendingPortionPreviewUrl) {
            try { URL.revokeObjectURL(_pendingPortionPreviewUrl); } catch (e) {}
            _pendingPortionPreviewUrl = null;
        }
        var modal = document.getElementById('meal-builder-portion-modal');
        if (modal) modal.classList.remove('visible');
        // If more queued native photos are waiting, start the next one.
        setTimeout(function () {
            if (typeof processNextBuilderPhoto === 'function') processNextBuilderPhoto();
        }, 50);
    };

    window.submitBuilderPortionPrompt = async function () {
        var input = document.getElementById('meal-builder-portion-input');
        var submit = document.getElementById('meal-builder-portion-submit');
        var modal = document.getElementById('meal-builder-portion-modal');
        if (!input) return;
        var portion = input.value.trim();
        if (portion.length < 1) return;

        var file = _pendingPortionPhoto;
        if (!file) {
            if (modal) modal.classList.remove('visible');
            return;
        }

        if (submit) { submit.disabled = true; submit.textContent = 'Analysing…'; }
        if (input) input.disabled = true;
        builderState.isAdding = true;
        updateSaveButtonState();
        showBuilderToast('Analysing photo…', 'info');

        try {
            var compressed = typeof compressMealImage === 'function'
                ? await compressMealImage(file)
                : file;
            var base64 = await fileToBase64Builder(compressed);
            var base64Data = base64.split(',')[1];

            var nutritionData = await analyzeFoodPhoto(
                base64Data,
                compressed.type || 'image/jpeg',
                portion
            );
            mergeAnalysisIntoBuilder(nutritionData);
            showBuilderToast('Item added!', 'success');

            // Clear pending state and close the prompt only on success.
            _pendingPortionPhoto = null;
            if (_pendingPortionPreviewUrl) {
                try { URL.revokeObjectURL(_pendingPortionPreviewUrl); } catch (e) {}
                _pendingPortionPreviewUrl = null;
            }
            if (modal) modal.classList.remove('visible');

            // Chain any additional pending native builder photos.
            setTimeout(function () {
                if (typeof processNextBuilderPhoto === 'function') processNextBuilderPhoto();
            }, 100);
        } catch (err) {
            console.error('Builder photo analysis failed:', err);
            showBuilderToast('Could not analyse photo. Please try again.', 'error');
            if (submit) { submit.disabled = false; submit.textContent = 'Analyze & Add'; }
            if (input) input.disabled = false;
        } finally {
            builderState.isAdding = false;
            updateSaveButtonState();
        }
    };

    // ─────────────────────────────────────────────
    // Native camera bridge — QuickMealActivity in "builder" mode
    // ─────────────────────────────────────────────
    //
    // Android has a native camera activity (QuickMealActivity) that takes
    // photos and scans barcodes much faster / more reliably than a
    // WebView camera. When launched in "builder" mode it writes each
    // analysed result to a separate queue in SharedPreferences instead
    // of logging it as a standalone meal. We read that queue every time
    // the WebView resumes and merge the pending items into the open
    // builder, so users can stack several photos or barcodes into a
    // single meal.

    function hasNativeBuilderCameraBridge() {
        return !!(window.NativePermissions
            && typeof window.NativePermissions.openQuickMealCameraForBuilder === 'function'
            && typeof window.NativePermissions.getPendingBuilderItems === 'function');
    }

    // Is the builder modal currently open on screen?
    function isBuilderModalOpen() {
        var modal = document.getElementById('meal-builder-modal');
        return !!(modal && modal.classList.contains('visible'));
    }

    // Drain the native queue of pending builder items and merge each
    // one into the open builder. Safe to call when the builder isn't
    // visible — in that case the items are left in the queue for the
    // next resume (we still clear the native queue, so we buffer them
    // in-memory and re-merge when the builder next opens).
    var _bufferedBuilderItems = [];

    function drainPendingBuilderItems() {
        if (!hasNativeBuilderCameraBridge()) return;
        var raw = null;
        try {
            raw = window.NativePermissions.getPendingBuilderItems();
        } catch (e) {
            return;
        }
        if (!raw) return;

        var parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            console.warn('Builder: failed to parse pending builder items', e);
            return;
        }
        if (!Array.isArray(parsed) || parsed.length === 0) return;

        // If the builder isn't open right now, buffer the items so we
        // can merge them the next time it opens.
        if (!isBuilderModalOpen()) {
            _bufferedBuilderItems = _bufferedBuilderItems.concat(parsed);
            return;
        }

        mergePendingArray(parsed);
    }

    function mergePendingArray(arr) {
        var merged = 0;
        for (var i = 0; i < arr.length; i++) {
            try {
                mergeAnalysisIntoBuilder(arr[i]);
                merged++;
            } catch (e) {
                console.warn('Builder: skip invalid pending item', e);
            }
        }
        if (merged > 0) {
            showBuilderToast(
                merged === 1 ? 'Item added!' : (merged + ' items added!'),
                'success'
            );
        }
    }

    // If items came in while the builder was closed, flush them when
    // the user reopens it. openMealBuilder is invoked via the modal
    // open flow; we hook into it by wrapping on the next tick.
    var _originalOpenMealBuilder = window.openMealBuilder;
    window.openMealBuilder = function () {
        _originalOpenMealBuilder.apply(this, arguments);
        if (_bufferedBuilderItems.length > 0) {
            var items = _bufferedBuilderItems.slice();
            _bufferedBuilderItems = [];
            // Defer slightly so the modal is fully rendered first.
            setTimeout(function () { mergePendingArray(items); }, 200);
        }
    };

    // Drain the native queue whenever the WebView comes back into focus
    // — this covers both the QuickMealActivity-finish case (Android
    // brings MainActivity back to the foreground, which fires focus /
    // visibilitychange on the WebView) and generic resume scenarios.
    // We also restore the builder modal here so it slides back up as
    // soon as the native camera activity finishes, regardless of
    // whether the user actually captured anything.
    function onWebViewResume() {
        if (document.visibilityState !== 'visible') return;
        // Slide the builder back up immediately — no need to wait for
        // the queue drain since the native activity has already finished.
        showBuilderAfterCamera();
        // Small delay so the native activity finishes writing the
        // SharedPreferences entry before we read it, then drain any
        // pending items + pending builder photos for the portion prompt.
        setTimeout(function () {
            drainPendingBuilderItems();
            drainPendingBuilderPhotos();
        }, 150);
    }
    document.addEventListener('visibilitychange', onWebViewResume);
    window.addEventListener('focus', function () {
        showBuilderAfterCamera();
        setTimeout(function () {
            drainPendingBuilderItems();
            drainPendingBuilderPhotos();
        }, 150);
    });

    // Photos coming back from the native builder camera are buffered
    // here so we can show the portion prompt for each one sequentially
    // (the UI can only handle one at a time).
    var _queuedBuilderPhotos = [];

    // Drain any raw-photo base64 entries that QuickMealActivity wrote to
    // the pending_builder_photos_queue instead of running analyse-food
    // itself, and start the portion-prompt flow for the first one. The
    // rest are kept in memory until the user submits / cancels the
    // current prompt, at which point processNextBuilderPhoto() picks
    // up the next one.
    function drainPendingBuilderPhotos() {
        if (!window.NativePermissions ||
            typeof window.NativePermissions.getPendingBuilderPhotos !== 'function') {
            return;
        }
        var raw = null;
        try {
            raw = window.NativePermissions.getPendingBuilderPhotos();
        } catch (e) {
            return;
        }
        if (!raw) return;

        var parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            console.warn('Builder: failed to parse pending builder photos', e);
            return;
        }
        if (!Array.isArray(parsed) || parsed.length === 0) return;

        _queuedBuilderPhotos = _queuedBuilderPhotos.concat(parsed);
        processNextBuilderPhoto();
    }

    function processNextBuilderPhoto() {
        // Skip if the portion prompt is already up (user is working
        // through the previous photo) or there's nothing left.
        if (_pendingPortionPhoto) return;
        if (_queuedBuilderPhotos.length === 0) return;

        var next = _queuedBuilderPhotos.shift();
        if (!next || !next.base64) {
            processNextBuilderPhoto();
            return;
        }
        try {
            var file = base64ToFileBuilder(next.base64, next.mimeType || 'image/jpeg');
            if (file) handleBuilderPhotoFile(file);
        } catch (e) {
            console.warn('Builder: failed to convert pending photo to File', e);
            processNextBuilderPhoto();
        }
    }

    // Convert a raw base64 JPEG string into a File object so the
    // existing portion-prompt + analyse-food flow can consume it.
    function base64ToFileBuilder(base64Data, mimeType) {
        var byteChars = atob(base64Data);
        var byteNumbers = new Array(byteChars.length);
        for (var i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
        }
        var byteArray = new Uint8Array(byteNumbers);
        var blob = new Blob([byteArray], { type: mimeType });
        return new File([blob], 'builder-photo-' + Date.now() + '.jpg', { type: mimeType });
    }

    // Merge a barcode-scanned product (already looked up via Open Food Facts
    // by the unified camera) into the meal builder as a single ingredient.
    // Shaped so `mergeAnalysisIntoBuilder` can consume it — we build a
    // one-item foodItems array at the currently selected servings / custom
    // amount, mirroring how `logBarcodeAsMeal` computes the nutrition.
    function handleBuilderBarcodeProduct(product, servings, amountMode, customAmount) {
        // A barcode scan finished — slide the builder back up over the
        // camera so the user can see the new ingredient appear and
        // either scan another or save the meal. Barcodes carry their
        // own serving info from Open Food Facts, so we don't need the
        // portion prompt here.
        showBuilderAfterCamera();
        if (!product) {
            showBuilderToast('No product to add.', 'error');
            return;
        }

        var mode = amountMode || 'servings';
        var srv = (typeof servings === 'number' && servings > 0) ? servings : 1;
        var custom = parseFloat(customAmount) || 0;

        var per, mult;
        if (mode === 'custom' && custom > 0) {
            per = product.per100g || {};
            mult = custom / 100.0;
        } else {
            per = product.isPerServing ? (product.perServing || {}) : (product.per100g || {});
            mult = srv;
        }

        var qty = (product.quantity || '') + ' ' + (product.servingSize || '');
        var isLiquid = /ml|litr/i.test(qty);
        var unit = isLiquid ? 'ml' : 'g';

        var portion;
        if (mode === 'custom' && custom > 0) {
            portion = Math.round(custom) + unit;
        } else if (product.isPerServing) {
            portion = (srv === 1 ? '1 serving' : srv + ' servings')
                + (product.servingSize ? ' (' + product.servingSize + ')' : '');
        } else {
            portion = Math.round(100 * srv) + 'g';
        }

        var name = product.name || 'Unknown product';
        if (product.brand) name = name + ' (' + product.brand + ')';

        var foodItem = {
            name: name,
            portion: portion,
            calories: (parseFloat(per.calories) || 0) * mult,
            protein_g: (parseFloat(per.protein_g) || 0) * mult,
            carbs_g: (parseFloat(per.carbs_g) || 0) * mult,
            fat_g: (parseFloat(per.fat_g) || 0) * mult,
            fiber_g: (parseFloat(per.fiber_g) || 0) * mult
        };

        var totals = {
            calories: foodItem.calories,
            protein_g: foodItem.protein_g,
            carbs_g: foodItem.carbs_g,
            fat_g: foodItem.fat_g,
            fiber_g: foodItem.fiber_g
        };

        var micronutrients = {};
        var micro = product.micro100g || {};
        for (var k in micro) {
            if (Object.prototype.hasOwnProperty.call(micro, k)) {
                micronutrients[k] = (parseFloat(micro[k]) || 0) * mult;
            }
        }

        try {
            mergeAnalysisIntoBuilder({
                foodItems: [foodItem],
                totals: totals,
                micronutrients: micronutrients,
                confidence: 'high',
                notes: 'Barcode: ' + (product.barcode || '')
            });
            showBuilderToast('Item added!', 'success');
        } catch (err) {
            console.error('Builder barcode merge failed:', err);
            showBuilderToast('Could not add product.', 'error');
        }
    }

    // Expose helpers so the unified camera (script-11) can route its
    // photo / barcode results straight back into the open meal builder
    // when it's launched in 'builder' mode.
    window.handleBuilderPhotoFile = handleBuilderPhotoFile;
    window.handleBuilderBarcodeProduct = handleBuilderBarcodeProduct;

    // Both the Photo and Barcode builder buttons go through this single
    // entry point. Using exactly the same camera as the homepage /
    // nutrition-tab camera button keeps the experience consistent, and
    // that camera handles both photo capture and barcode scanning — so
    // we don't need a separate "barcode mode" any more. Before the
    // camera opens we drop the builder modal down off-screen so the
    // camera view is unobstructed; it slides back up as soon as the
    // camera closes (photo captured, barcode scanned, or cancelled).
    function openBuilderCamera() {
        if (builderState.isAdding) return;

        hideBuilderForCamera();

        if (typeof openMealCameraDirect === 'function') {
            try {
                openMealCameraDirect('builder');
                return;
            } catch (e) {
                console.warn('openMealCameraDirect(builder) threw, falling back', e);
                showBuilderAfterCamera();
            }
        }

        // Last-resort fallback — the old file-input path.
        if (typeof openCameraWithCallback === 'function') {
            openCameraWithCallback(function (file) {
                handleBuilderPhotoFile(file);
            });
            return;
        }

        showBuilderAfterCamera();
        showBuilderToast('Camera not available on this device.', 'error');
    }

    window.addBuilderItemViaPhoto = openBuilderCamera;
    window.addBuilderItemViaBarcode = openBuilderCamera;

    async function analyzeFoodPhoto(base64Data, mimeType, description) {
        var res = await fetch('/.netlify/functions/analyze-food', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageBase64: base64Data,
                mimeType: mimeType,
                description: description || '',
                only_verify: false
            })
        });
        if (!res.ok) {
            var errData = await res.json().catch(function () { return { error: 'Unknown error' }; });
            throw new Error(errData.error || 'analyze-food returned ' + res.status);
        }
        var result = await res.json();
        if (!result.success || !result.data) {
            throw new Error('Invalid analysis response');
        }
        return result.data;
    }

    // Small local base64 helper (mirrors fileToBase64 in script-11 but keeps this module self-contained)
    function fileToBase64Builder(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ─────────────────────────────────────────────
    // Add via TEXT — reuses analyze-meal-text endpoint
    // ─────────────────────────────────────────────

    window.addBuilderItemViaText = function () {
        var modal = document.getElementById('meal-builder-text-modal');
        var input = document.getElementById('meal-builder-text-input');
        var submit = document.getElementById('meal-builder-text-submit');
        if (!modal || !input || !submit) return;

        input.value = '';
        submit.disabled = true;
        modal.classList.add('visible');
        setTimeout(function () { input.focus(); }, 150);
    };

    window.closeBuilderTextInput = function () {
        var modal = document.getElementById('meal-builder-text-modal');
        if (modal) modal.classList.remove('visible');
    };

    window.submitBuilderTextItem = async function () {
        var input = document.getElementById('meal-builder-text-input');
        if (!input) return;
        var description = input.value.trim();
        if (description.length < 3) return;

        closeBuilderTextInput();
        builderState.isAdding = true;
        updateSaveButtonState();
        showBuilderToast('Analysing item…', 'info');

        try {
            var res = await fetch('/.netlify/functions/analyze-meal-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: description, mealType: 'snack' })
            });
            if (!res.ok) {
                var errData = await res.json().catch(function () { return { error: 'Unknown error' }; });
                throw new Error(errData.error || 'analyze-meal-text returned ' + res.status);
            }
            var result = await res.json();
            if (!result.success || !result.data) throw new Error('Invalid analysis response');
            mergeAnalysisIntoBuilder(result.data);
            showBuilderToast('Item added!', 'success');
        } catch (err) {
            console.error('Builder text analysis failed:', err);
            showBuilderToast('Could not analyse item. Please try again.', 'error');
        } finally {
            builderState.isAdding = false;
            updateSaveButtonState();
        }
    };

    // Enable text-input submit button as the user types
    document.addEventListener('DOMContentLoaded', function () {
        var input = document.getElementById('meal-builder-text-input');
        var submit = document.getElementById('meal-builder-text-submit');
        if (input && submit) {
            input.addEventListener('input', function () {
                submit.disabled = input.value.trim().length < 3;
            });
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !submit.disabled) {
                    submit.click();
                }
            });
        }

        // Enable the portion-prompt submit button as the user types a
        // portion size (accept even a single character like "1" since
        // the user can follow up with "cup"/"slice" etc.).
        var portionInput = document.getElementById('meal-builder-portion-input');
        var portionSubmit = document.getElementById('meal-builder-portion-submit');
        if (portionInput && portionSubmit) {
            portionInput.addEventListener('input', function () {
                portionSubmit.disabled = portionInput.value.trim().length < 1;
            });
            portionInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !portionSubmit.disabled) {
                    e.preventDefault();
                    portionSubmit.click();
                }
            });
        }

        // Auto-fill the meal name with a suggestion once items exist
        var nameEl = document.getElementById('meal-builder-name');
        if (nameEl) {
            nameEl.addEventListener('focus', function () {
                if (!nameEl.value && builderState.items.length > 0) {
                    nameEl.placeholder = suggestMealName();
                }
            });
        }
    });

    function suggestMealName() {
        if (builderState.items.length === 0) return 'Name your meal';
        var names = builderState.items.slice(0, 3).map(function (i) { return i.name || 'Item'; });
        return names.join(' + ');
    }

    // ─────────────────────────────────────────────
    // Save the built meal to user_saved_meals
    // ─────────────────────────────────────────────

    window.saveBuiltMeal = async function () {
        if (builderState.items.length === 0 || builderState.isAdding) return;

        var nameEl = document.getElementById('meal-builder-name');
        var name = (nameEl && nameEl.value.trim()) || suggestMealName();

        var userId = window.currentUser && window.currentUser.id;
        if (!userId && window.supabaseClient) {
            try {
                var sess = await window.supabaseClient.auth.getSession();
                userId = sess && sess.data && sess.data.session && sess.data.session.user && sess.data.session.user.id;
                if (userId) window.currentUser = sess.data.session.user;
            } catch (e) {
                console.error('saveBuiltMeal: session lookup failed', e);
            }
        }
        if (!userId || !window.supabaseClient) {
            showBuilderToast('Not signed in — please reopen the app.', 'error');
            return;
        }

        var saveBtn = document.getElementById('meal-builder-save-btn');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

        try {
            var row = {
                user_id: userId,
                name: name.substring(0, 60),
                food_items: builderState.items,
                calories: builderState.totals.calories,
                protein_g: builderState.totals.protein_g,
                carbs_g: builderState.totals.carbs_g,
                fat_g: builderState.totals.fat_g,
                fiber_g: builderState.totals.fiber_g,
                micronutrients: builderState.micronutrients || {}
            };

            var resp = await window.supabaseClient
                .from('user_saved_meals')
                .insert(row)
                .select();

            if (resp.error) throw resp.error;

            closeMealBuilder();
            showBuilderToast('"' + name.substring(0, 30) + '" saved!', 'success');

            // Invalidate the saved-meals cache so the next open of the Recent
            // Meals modal shows this newly saved meal without a stale list.
            window._savedMealsCache = null;

            // Refresh the native saved-meals cache so the app shortcut overlay
            // can show the new meal without reopening the WebView.
            refreshNativeSavedMealsCache();
        } catch (err) {
            console.error('Error saving built meal:', err);
            showBuilderToast('Could not save meal. Please try again.', 'error');
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Meal'; }
        }
    };

    // ─────────────────────────────────────────────
    // Saved-meal loading & quick-log from Recent modal
    // ─────────────────────────────────────────────

    // Called by the "Saved" tab of the Recent Meals modal.
    window.loadSavedMeals = async function () {
        var listEl = document.getElementById('recent-meals-list');
        if (!listEl) return;

        listEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">Loading saved meals…</div>';

        try {
            if (!window.supabaseClient) return;
            var userId = window.currentUser && window.currentUser.id;
            if (!userId) return;

            var resp = await window.supabaseClient
                .from('user_saved_meals')
                .select('id, name, food_items, calories, protein_g, carbs_g, fat_g, fiber_g, micronutrients, times_logged, last_logged_at, created_at')
                .eq('user_id', userId)
                .order('last_logged_at', { ascending: false, nullsFirst: false })
                .order('created_at', { ascending: false })
                .limit(100);

            if (resp.error) {
                console.error('Error loading saved meals:', resp.error);
                listEl.innerHTML = '<div class="recent-meals-empty"><p>Could not load saved meals.</p></div>';
                return;
            }

            var meals = resp.data || [];
            window._savedMealsData = meals;
            // Mirror the freshest list into the native SharedPreferences cache
            // so QuickMealActivity's "Your Meals" view stays in sync.
            pushSavedMealsToNative(meals);

            if (meals.length === 0) {
                listEl.innerHTML =
                    '<div class="recent-meals-empty">' +
                    '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
                    '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>' +
                    '</svg>' +
                    '<p>No saved meals yet.<br><span style="font-size:0.85rem;">Tap the 🍽️ button on the tracker to build one.</span></p>' +
                    '</div>';
                return;
            }

            var html = '';
            for (var i = 0; i < meals.length; i++) {
                var m = meals[i];
                var cal = Math.round(m.calories || 0);
                var p = Math.round(m.protein_g || 0);
                var c = Math.round(m.carbs_g || 0);
                var f = Math.round(m.fat_g || 0);
                html +=
                    '<div class="recent-meal-item" onclick="logSavedMealNow(' + i + ')">' +
                    '<div class="recent-meal-icon">&#127869;</div>' +
                    '<div class="recent-meal-info">' +
                    '<div class="recent-meal-name">' + escapeHtml(m.name || 'Saved meal') + '</div>' +
                    '<div class="recent-meal-macros">' + cal + ' cal &middot; P: ' + p + 'g &middot; C: ' + c + 'g &middot; F: ' + f + 'g</div>' +
                    '</div>' +
                    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" style="flex-shrink:0;"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
                    '</div>';
            }
            listEl.innerHTML = html;
        } catch (err) {
            console.error('loadSavedMeals error:', err);
            listEl.innerHTML = '<div class="recent-meals-empty"><p>Something went wrong.</p></div>';
        }
    };

    // Quick-log a saved meal directly to today's meal_logs using the existing
    // saveMealLogWithType helper from script-11.
    window.logSavedMealNow = async function (index) {
        var meal = window._savedMealsData && window._savedMealsData[index];
        if (!meal) return;

        if (typeof saveMealLogWithType !== 'function') {
            showBuilderToast('Meal logger not ready yet — please retry.', 'error');
            return;
        }

        if (typeof closeRecentMealsModal === 'function') closeRecentMealsModal();
        showBuilderToast('Logging "' + (meal.name || 'meal').substring(0, 30) + '"…', 'info');

        try {
            var mealType = typeof autoDetectMealType === 'function' ? autoDetectMealType() : 'snack';
            if (typeof selectedMealType !== 'undefined') {
                // The script-11 helper reads the global; update it so the meal_type is correct
                window.selectedMealType = mealType;
            }

            await saveMealLogWithType({
                foodItems: meal.food_items || [],
                totals: {
                    calories: parseFloat(meal.calories) || 0,
                    protein_g: parseFloat(meal.protein_g) || 0,
                    carbs_g: parseFloat(meal.carbs_g) || 0,
                    fat_g: parseFloat(meal.fat_g) || 0,
                    fiber_g: parseFloat(meal.fiber_g) || 0
                },
                micronutrients: meal.micronutrients || {},
                confidence: 'high',
                notes: 'Saved meal: ' + (meal.name || ''),
                mealType: mealType,
                inputMethod: 'saved',
                mealDescription: meal.name || ''
            });

            // Bump usage counter (fire-and-forget)
            try {
                await window.supabaseClient
                    .from('user_saved_meals')
                    .update({
                        times_logged: (meal.times_logged || 0) + 1,
                        last_logged_at: new Date().toISOString()
                    })
                    .eq('id', meal.id);
                // Re-mirror the cache so the overlay's most-used ordering
                // reflects the new usage on the next open.
                refreshNativeSavedMealsCache();
            } catch (e) {
                console.warn('Could not update saved meal usage:', e);
            }

            try { if (typeof recalculateDailyNutrition === 'function') await recalculateDailyNutrition(); } catch (e) {}
            try { if (typeof loadTodayNutrition === 'function') await loadTodayNutrition(); } catch (e) {}
            try { if (typeof loadMicronutrientInsights === 'function') await loadMicronutrientInsights(); } catch (e) {}
            try { if (typeof checkMealBadges === 'function') checkMealBadges(); } catch (e) {}

            showBuilderToast('"' + (meal.name || 'Meal').substring(0, 30) + '" logged!', 'success');
        } catch (err) {
            console.error('logSavedMealNow failed:', err);
            showBuilderToast('Could not log meal. Please try again.', 'error');
        }
    };

    // ─────────────────────────────────────────────
    // Recent / Saved tab switcher (adds Saved tab to existing Recent Meals modal)
    // ─────────────────────────────────────────────

    window.switchRecentMealsTab = function (tab) {
        var tabs = document.querySelectorAll('.recent-meals-tab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tab);
        }
        // Hide the single-item confirm view when switching tabs
        var confirmEl = document.getElementById('recent-meal-confirm');
        if (confirmEl) confirmEl.classList.remove('active');
        var list = document.getElementById('recent-meals-list');
        if (list) list.style.display = '';

        if (tab === 'saved') {
            loadSavedMeals();
        } else if (typeof loadRecentMeals === 'function') {
            loadRecentMeals();
        }
    };

    // ─────────────────────────────────────────────
    // Native saved-meals cache (for QuickMealActivity overlay)
    // ─────────────────────────────────────────────

    // Push the given meals array to the native SharedPreferences cache so the
    // app-shortcut overlay's "Your Meals" view can show them without launching
    // the WebView. Silently no-ops on non-native platforms.
    function pushSavedMealsToNative(meals) {
        try {
            if (!window.NativePermissions || typeof window.NativePermissions.setSavedMealsCache !== 'function') return;
            var slim = (meals || []).slice(0, 50).map(function (m) {
                return {
                    id: m.id,
                    name: m.name,
                    food_items: m.food_items || [],
                    calories: parseFloat(m.calories) || 0,
                    protein_g: parseFloat(m.protein_g) || 0,
                    carbs_g: parseFloat(m.carbs_g) || 0,
                    fat_g: parseFloat(m.fat_g) || 0,
                    fiber_g: parseFloat(m.fiber_g) || 0,
                    micronutrients: m.micronutrients || {}
                };
            });
            window.NativePermissions.setSavedMealsCache(JSON.stringify(slim));
        } catch (e) {
            console.warn('pushSavedMealsToNative failed:', e);
        }
    }

    // Re-fetch saved meals from Supabase and re-push to native. Used after
    // saving a new meal so the overlay reflects it immediately.
    async function refreshNativeSavedMealsCache() {
        try {
            if (!window.supabaseClient) return;
            var userId = window.currentUser && window.currentUser.id;
            if (!userId) return;
            var resp = await window.supabaseClient
                .from('user_saved_meals')
                .select('id, name, food_items, calories, protein_g, carbs_g, fat_g, fiber_g, micronutrients, last_logged_at, created_at')
                .eq('user_id', userId)
                .order('last_logged_at', { ascending: false, nullsFirst: false })
                .order('created_at', { ascending: false })
                .limit(50);
            if (resp.error) return;
            pushSavedMealsToNative(resp.data || []);
        } catch (e) {
            console.warn('refreshNativeSavedMealsCache failed:', e);
        }
    }

    // Expose for other modules (e.g. when a saved meal is logged elsewhere
    // and times_logged changes, we want to re-mirror the cache)
    window.refreshNativeSavedMealsCache = refreshNativeSavedMealsCache;

    // On startup, once the user is authenticated, mirror the saved meals to
    // the native cache so the app-shortcut overlay has fresh data even if the
    // user never opens the Saved tab in this session.
    document.addEventListener('DOMContentLoaded', function () {
        var attempts = 0;
        var iv = setInterval(function () {
            attempts++;
            if (window.currentUser && window.currentUser.id && window.supabaseClient) {
                clearInterval(iv);
                refreshNativeSavedMealsCache();
            } else if (attempts > 60) {
                clearInterval(iv);
            }
        }, 500);
    });

    // ─────────────────────────────────────────────
    // Tiny helpers
    // ─────────────────────────────────────────────

    function setText(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = String(val);
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showBuilderToast(message, type) {
        if (typeof showToast === 'function') {
            showToast(message, type || 'info');
        } else {
            console.log('[MealBuilder]', message);
        }
    }

})();
