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
    var builderFoodSearchTimer = null;
    var builderFoodSearchController = null;
    var builderFoodSearchResults = [];
    var selectedBuilderFood = null;
    var builderMyFoods = [];

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
        // Search is the primary action in the simplified builder.
        setTimeout(function () {
            var searchEl = document.getElementById('meal-builder-food-search');
            if (searchEl) searchEl.focus();
        }, 250);
    };

    window.closeMealBuilder = function () {
        var modal = document.getElementById('meal-builder-modal');
        if (modal) {
            modal.classList.remove('visible');
            modal.classList.remove('hidden-for-camera');
        }
        _builderHiddenForCamera = false;
        // Drop any in-flight quick-meal intercept so a save that
        // fires after the builder closes goes through the normal
        // standalone-meal path instead of falling into a closed
        // builder.
        window._builderInterceptNextQuickMeal = false;
        closeBuilderTextInput();
        closeBuilderBarcodeInput();
        closeBuilderServingPicker();
        closeBuilderCustomFood();
        closeBuilderMyFoods();
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
        var searchEl = document.getElementById('meal-builder-food-search');
        var resultsEl = document.getElementById('meal-builder-search-results');
        if (searchEl) searchEl.value = '';
        if (resultsEl) resultsEl.innerHTML = '';
        setBuilderSearchStatus('Type at least two letters to search foods.');
        builderFoodSearchResults = [];
        selectedBuilderFood = null;
        builderMyFoods = [];
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
                '<p><strong>Your meal is empty</strong><br><span>Add an ingredient above. Nothing is logged until you finish the meal.</span></p>' +
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
        var ready = builderState.items.length > 0 && !builderState.isAdding;
        var logBtn = document.getElementById('meal-builder-save-btn');
        var saveBtn = document.getElementById('meal-builder-save-only-btn');
        if (logBtn) logBtn.disabled = !ready;
        if (saveBtn) saveBtn.disabled = !ready;
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
    // Search and add foods
    // ─────────────────────────────────────────────

    function setBuilderSearchStatus(message) {
        var status = document.getElementById('meal-builder-search-status');
        if (status) status.textContent = message || '';
    }

    function setBuilderSearchLoading(loading) {
        var spinner = document.getElementById('meal-builder-search-spinner');
        if (spinner) spinner.classList.toggle('active', !!loading);
    }

    async function getBuilderUserId() {
        var userId = window.currentUser && window.currentUser.id;
        if (!userId && window.supabaseClient) {
            try {
                var sessionResult = await window.supabaseClient.auth.getSession();
                userId = sessionResult && sessionResult.data && sessionResult.data.session && sessionResult.data.session.user && sessionResult.data.session.user.id;
                if (userId) window.currentUser = sessionResult.data.session.user;
            } catch (error) {
                console.warn('Meal Builder session lookup failed:', error);
            }
        }
        return userId || '';
    }

    function customFoodRowToSearchFood(row, source) {
        var grams = Math.max(1, parseFloat(row.serving_weight_g) || 100);
        var scaleTo100g = 100 / grams;
        return {
            id: String(row.id || ''),
            name: row.name || 'Custom food',
            brand: source === 'balance-community-food' ? 'Balance community' : 'My Foods',
            per100g: {
                calories: (parseFloat(row.calories) || 0) * scaleTo100g,
                protein_g: (parseFloat(row.protein_g) || 0) * scaleTo100g,
                carbs_g: (parseFloat(row.carbs_g) || 0) * scaleTo100g,
                fat_g: (parseFloat(row.fat_g) || 0) * scaleTo100g,
                fiber_g: (parseFloat(row.fiber_g) || 0) * scaleTo100g
            },
            micronutrientsPer100g: {},
            measures: [{
                label: (row.serving_label || '1 serving') + ' (' + Math.round(grams * 10) / 10 + ' g)',
                grams: grams
            }],
            source: source || 'custom-food',
            source_id: String(row.id || '')
        };
    }

    async function searchSharedBuilderFoods(query) {
        if (!window.supabaseClient || query.length < 2) return [];
        try {
            var response = await window.supabaseClient
                .from('user_custom_foods')
                .select('id, name, serving_label, serving_weight_g, calories, protein_g, carbs_g, fat_g, fiber_g, times_used, updated_at')
                .eq('is_shared', true)
                .ilike('name', '%' + query + '%')
                .order('times_used', { ascending: false })
                .order('updated_at', { ascending: false })
                .limit(6);
            if (response.error) throw response.error;
            return (response.data || []).map(function (row) {
                return customFoodRowToSearchFood(row, 'balance-community-food');
            });
        } catch (error) {
            console.warn('Shared custom-food search unavailable:', error);
            return [];
        }
    }

    async function searchBuilderFoods(query) {
        query = String(query || '').trim();
        var resultsEl = document.getElementById('meal-builder-search-results');
        if (query.length < 2) {
            builderFoodSearchResults = [];
            if (resultsEl) resultsEl.innerHTML = '';
            setBuilderSearchLoading(false);
            setBuilderSearchStatus('Type at least two letters to search foods.');
            return;
        }

        if (builderFoodSearchController) builderFoodSearchController.abort();
        builderFoodSearchController = typeof AbortController !== 'undefined' ? new AbortController() : null;
        setBuilderSearchLoading(true);
        setBuilderSearchStatus('Searching foods...');

        try {
            var searchResponses = await Promise.all([
                fetch('/.netlify/functions/food-search?q=' + encodeURIComponent(query), {
                    signal: builderFoodSearchController ? builderFoodSearchController.signal : undefined
                }),
                searchSharedBuilderFoods(query)
            ]);
            var response = searchResponses[0];
            var sharedFoods = searchResponses[1] || [];
            var payload = await response.json().catch(function () { return {}; });
            if (!response.ok || !payload.success) throw new Error(payload.error || 'Search failed');
            builderFoodSearchResults = sharedFoods.concat(Array.isArray(payload.results) ? payload.results : []);
            renderBuilderFoodResults();
            setBuilderSearchStatus(builderFoodSearchResults.length
                ? builderFoodSearchResults.length + ' matches. Tap + to choose the amount.'
                : 'No matches found. Try a simpler food name.');
        } catch (error) {
            if (error && error.name === 'AbortError') return;
            console.error('Builder food search failed:', error);
            builderFoodSearchResults = [];
            if (resultsEl) resultsEl.innerHTML = '';
            setBuilderSearchStatus('Food search could not load. Please try again.');
        } finally {
            setBuilderSearchLoading(false);
        }
    }

    function renderBuilderFoodResults() {
        var container = document.getElementById('meal-builder-search-results');
        if (!container) return;
        var html = '';
        for (var i = 0; i < builderFoodSearchResults.length; i++) {
            var food = builderFoodSearchResults[i];
            var measure = food.measures && food.measures[0] ? food.measures[0] : { label: '100 g', grams: 100 };
            var calories = Math.round(((food.per100g && food.per100g.calories) || 0) * (measure.grams || 100) / 100);
            var detail = (food.brand ? escapeHtml(food.brand) + ' · ' : '') + escapeHtml(measure.label || '100 g') + ' · ' + calories + ' calories';
            html += '<button type="button" class="meal-builder-search-result" onclick="openBuilderServingPicker(' + i + ')">' +
                '<span class="meal-builder-result-icon" aria-hidden="true">' + (food.source === 'balance-community-food' ? '&#9825;' : '&#127869;') + '</span>' +
                '<span class="meal-builder-result-copy"><strong>' + escapeHtml(food.name || 'Food') + '</strong><small>' + detail + '</small></span>' +
                '<span class="meal-builder-result-add" aria-label="Choose serving">+</span>' +
                '</button>';
        }
        container.innerHTML = html;
    }

    window.openBuilderServingPicker = function (index) {
        showBuilderServingPicker(builderFoodSearchResults[index] || null);
    };

    function showBuilderServingPicker(food) {
        selectedBuilderFood = food;
        if (!selectedBuilderFood) return;
        var modal = document.getElementById('meal-builder-serving-modal');
        var nameEl = document.getElementById('meal-builder-serving-name');
        var select = document.getElementById('meal-builder-serving-measure');
        var count = document.getElementById('meal-builder-serving-count');
        if (nameEl) nameEl.textContent = selectedBuilderFood.name || 'Food';
        if (select) {
            select.innerHTML = (selectedBuilderFood.measures || [{ label: '100 g', grams: 100 }]).map(function (measure, measureIndex) {
                return '<option value="' + measureIndex + '">' + escapeHtml(measure.label || '100 g') + '</option>';
            }).join('') + '<option value="custom-grams">Custom weight in grams</option>';
            select.value = '0';
        }
        if (count) {
            count.value = '1';
            count.min = '0.25';
            count.max = '50';
            count.step = '0.25';
        }
        updateBuilderServingCountLabel(false);
        updateBuilderServingPreview();
        if (modal) modal.classList.add('visible');
    }

    window.closeBuilderServingPicker = function () {
        var modal = document.getElementById('meal-builder-serving-modal');
        if (modal) modal.classList.remove('visible');
        selectedBuilderFood = null;
    };

    window.adjustBuilderServingCount = function (delta) {
        var input = document.getElementById('meal-builder-serving-count');
        var select = document.getElementById('meal-builder-serving-measure');
        if (!input) return;
        var customGrams = !!(select && select.value === 'custom-grams');
        var step = customGrams ? 10 : 0.5;
        var min = customGrams ? 1 : 0.25;
        var max = customGrams ? 5000 : 50;
        var next = Math.min(max, Math.max(min, (parseFloat(input.value) || (customGrams ? 100 : 1)) + (delta * step)));
        input.value = String(Math.round(next * 100) / 100);
        updateBuilderServingPreview();
    };

    function updateBuilderServingCountLabel(customGrams) {
        var label = document.getElementById('meal-builder-serving-count-label');
        if (label) label.textContent = customGrams ? 'Weight in grams' : 'Number of servings';
    }

    function handleBuilderServingMeasureChange() {
        var select = document.getElementById('meal-builder-serving-measure');
        var input = document.getElementById('meal-builder-serving-count');
        var customGrams = !!(select && select.value === 'custom-grams');
        updateBuilderServingCountLabel(customGrams);
        if (input) {
            input.value = customGrams ? '100' : '1';
            input.min = customGrams ? '1' : '0.25';
            input.max = customGrams ? '5000' : '50';
            input.step = customGrams ? '1' : '0.25';
        }
        updateBuilderServingPreview();
    }

    function selectedServingValues() {
        if (!selectedBuilderFood) return null;
        var select = document.getElementById('meal-builder-serving-measure');
        var countEl = document.getElementById('meal-builder-serving-count');
        var measures = selectedBuilderFood.measures || [{ label: '100 g', grams: 100 }];
        var customGrams = !!(select && select.value === 'custom-grams');
        var measure = customGrams ? { label: 'g', grams: 1 } : (measures[Math.max(0, parseInt(select && select.value, 10) || 0)] || measures[0]);
        var count = customGrams
            ? Math.min(5000, Math.max(1, parseFloat(countEl && countEl.value) || 100))
            : Math.min(50, Math.max(0.25, parseFloat(countEl && countEl.value) || 1));
        var grams = (parseFloat(measure.grams) || 100) * count;
        var portionLabel = customGrams ? Math.round(grams * 10) / 10 + ' g' : ((count === 1 ? '' : count + ' × ') + (measure.label || Math.round(grams) + ' g'));
        return { measure: measure, count: count, grams: grams, scale: grams / 100, portionLabel: portionLabel };
    }

    function updateBuilderServingPreview() {
        var values = selectedServingValues();
        var preview = document.getElementById('meal-builder-serving-preview');
        if (!values || !preview) return;
        var per100g = selectedBuilderFood.per100g || {};
        preview.textContent = Math.round((per100g.calories || 0) * values.scale) + ' calories · P ' +
            Math.round((per100g.protein_g || 0) * values.scale) + 'g · C ' +
            Math.round((per100g.carbs_g || 0) * values.scale) + 'g · F ' +
            Math.round((per100g.fat_g || 0) * values.scale) + 'g';
    }

    window.addSelectedBuilderFood = function () {
        var values = selectedServingValues();
        if (!values || !selectedBuilderFood) return;
        var per100g = selectedBuilderFood.per100g || {};
        var micros = selectedBuilderFood.micronutrientsPer100g || {};
        var scaledMicros = {};
        for (var key in micros) {
            if (Object.prototype.hasOwnProperty.call(micros, key)) scaledMicros[key] = (parseFloat(micros[key]) || 0) * values.scale;
        }
        builderState.items.push({
            name: selectedBuilderFood.name || 'Food',
            portion: values.portionLabel,
            portion_weight_g: values.grams,
            calories: (per100g.calories || 0) * values.scale,
            protein_g: (per100g.protein_g || 0) * values.scale,
            carbs_g: (per100g.carbs_g || 0) * values.scale,
            fat_g: (per100g.fat_g || 0) * values.scale,
            fiber_g: (per100g.fiber_g || 0) * values.scale,
            micronutrients: scaledMicros,
            source: selectedBuilderFood.source || 'usda-food-search',
            source_id: selectedBuilderFood.source_id || selectedBuilderFood.id || ''
        });
        recalcTotals();
        renderBuilder();
        closeBuilderServingPicker();
        showBuilderToast('Ingredient added!', 'success');
    };

    // ─────────────────────────────────────────────
    // Custom foods — account-level My Foods plus optional community sharing
    // ─────────────────────────────────────────────

    function customFoodNumber(id) {
        var input = document.getElementById(id);
        var value = parseFloat(input && input.value);
        return isFinite(value) && value >= 0 ? value : 0;
    }

    function setCustomFoodStatus(message, isError) {
        var status = document.getElementById('meal-builder-custom-status');
        if (!status) return;
        status.textContent = message || '';
        status.classList.toggle('error', !!isError);
    }

    window.openBuilderCustomFood = function () {
        closeBuilderMyFoods();
        var modal = document.getElementById('meal-builder-custom-food-modal');
        var nameInput = document.getElementById('meal-builder-custom-name');
        var searchInput = document.getElementById('meal-builder-food-search');
        if (nameInput && !nameInput.value.trim() && searchInput && searchInput.value.trim()) {
            nameInput.value = searchInput.value.trim().substring(0, 80);
        }
        setCustomFoodStatus('', false);
        if (modal) modal.classList.add('visible');
        setTimeout(function () { if (nameInput) nameInput.focus(); }, 120);
    };

    window.closeBuilderCustomFood = function () {
        var modal = document.getElementById('meal-builder-custom-food-modal');
        if (modal) modal.classList.remove('visible');
        setCustomFoodStatus('', false);
    };

    function resetBuilderCustomFoodForm() {
        var defaults = {
            'meal-builder-custom-name': '',
            'meal-builder-custom-serving-label': '1 serving',
            'meal-builder-custom-weight': '',
            'meal-builder-custom-calories': '',
            'meal-builder-custom-protein': '',
            'meal-builder-custom-carbs': '',
            'meal-builder-custom-fat': '',
            'meal-builder-custom-fiber': ''
        };
        for (var id in defaults) {
            if (!Object.prototype.hasOwnProperty.call(defaults, id)) continue;
            var input = document.getElementById(id);
            if (input) input.value = defaults[id];
        }
        var shared = document.getElementById('meal-builder-custom-shared');
        if (shared) shared.checked = true;
    }

    function addCustomFoodRowToBuilder(row) {
        var grams = Math.max(1, parseFloat(row.serving_weight_g) || 100);
        builderState.items.push({
            name: row.name || 'Custom food',
            portion: (row.serving_label || '1 serving') + ' · ' + Math.round(grams * 10) / 10 + ' g',
            portion_weight_g: grams,
            calories: parseFloat(row.calories) || 0,
            protein_g: parseFloat(row.protein_g) || 0,
            carbs_g: parseFloat(row.carbs_g) || 0,
            fat_g: parseFloat(row.fat_g) || 0,
            fiber_g: parseFloat(row.fiber_g) || 0,
            micronutrients: {},
            source: row.is_shared ? 'balance-community-food' : 'custom-food',
            source_id: String(row.id || '')
        });
        recalcTotals();
        renderBuilder();
    }

    window.saveBuilderCustomFood = async function () {
        var nameInput = document.getElementById('meal-builder-custom-name');
        var servingInput = document.getElementById('meal-builder-custom-serving-label');
        var weight = customFoodNumber('meal-builder-custom-weight');
        var protein = customFoodNumber('meal-builder-custom-protein');
        var carbs = customFoodNumber('meal-builder-custom-carbs');
        var fat = customFoodNumber('meal-builder-custom-fat');
        var fiber = customFoodNumber('meal-builder-custom-fiber');
        var caloriesInput = document.getElementById('meal-builder-custom-calories');
        var calories = customFoodNumber('meal-builder-custom-calories');
        if (caloriesInput && !caloriesInput.value.trim()) calories = (protein * 4) + (carbs * 4) + (fat * 9);
        var name = nameInput ? nameInput.value.trim() : '';
        var servingLabel = servingInput ? servingInput.value.trim() : '';
        var sharedInput = document.getElementById('meal-builder-custom-shared');
        var isShared = !!(sharedInput && sharedInput.checked);

        if (!name) return setCustomFoodStatus('Enter a food name.', true);
        if (!servingLabel) return setCustomFoodStatus('Enter a serving name, such as 1 slice.', true);
        if (weight <= 0 || weight > 5000) return setCustomFoodStatus('Enter a serving weight between 1 and 5,000 grams.', true);
        if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return setCustomFoodStatus('Enter calories or at least one macro.', true);

        var userId = await getBuilderUserId();
        if (!userId || !window.supabaseClient) return setCustomFoodStatus('Please sign in again to save this food.', true);

        var saveButton = document.getElementById('meal-builder-custom-save');
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = 'Saving...';
        }
        setCustomFoodStatus('', false);

        try {
            var row = {
                user_id: userId,
                name: name.substring(0, 80),
                serving_label: servingLabel.substring(0, 80),
                serving_weight_g: weight,
                calories: calories,
                protein_g: protein,
                carbs_g: carbs,
                fat_g: fat,
                fiber_g: fiber,
                is_shared: isShared,
                shared_at: isShared ? new Date().toISOString() : null
            };
            var response = await window.supabaseClient
                .from('user_custom_foods')
                .insert(row)
                .select('id, name, serving_label, serving_weight_g, calories, protein_g, carbs_g, fat_g, fiber_g, is_shared, created_at');
            if (response.error) throw response.error;
            var saved = response.data && response.data[0];
            if (!saved) throw new Error('Saved food was not returned');

            addCustomFoodRowToBuilder(saved);
            resetBuilderCustomFoodForm();
            closeBuilderCustomFood();
            showBuilderToast(isShared ? 'Food saved, added, and shared with Balance!' : 'Food saved and added!', 'success');
        } catch (error) {
            console.error('Could not save custom food:', error);
            setCustomFoodStatus('Could not save this food. Please try again.', true);
        } finally {
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = 'Save & add';
            }
        }
    };

    window.openBuilderMyFoods = async function () {
        closeBuilderCustomFood();
        var modal = document.getElementById('meal-builder-my-foods-modal');
        var list = document.getElementById('meal-builder-my-foods-list');
        if (modal) modal.classList.add('visible');
        if (list) list.innerHTML = '<div class="meal-builder-my-foods-empty">Loading My Foods...</div>';

        var userId = await getBuilderUserId();
        if (!userId || !window.supabaseClient) {
            if (list) list.innerHTML = '<div class="meal-builder-my-foods-empty">Please sign in again to load My Foods.</div>';
            return;
        }

        try {
            var response = await window.supabaseClient
                .from('user_custom_foods')
                .select('id, name, serving_label, serving_weight_g, calories, protein_g, carbs_g, fat_g, fiber_g, is_shared, times_used, last_used_at, updated_at')
                .eq('user_id', userId)
                .order('last_used_at', { ascending: false, nullsFirst: false })
                .order('updated_at', { ascending: false })
                .limit(100);
            if (response.error) throw response.error;
            builderMyFoods = response.data || [];
            renderBuilderMyFoods();
        } catch (error) {
            console.error('Could not load My Foods:', error);
            if (list) list.innerHTML = '<div class="meal-builder-my-foods-empty">Could not load My Foods. Please try again.</div>';
        }
    };

    window.closeBuilderMyFoods = function () {
        var modal = document.getElementById('meal-builder-my-foods-modal');
        if (modal) modal.classList.remove('visible');
    };

    function renderBuilderMyFoods() {
        var list = document.getElementById('meal-builder-my-foods-list');
        if (!list) return;
        if (!builderMyFoods.length) {
            list.innerHTML = '<div class="meal-builder-my-foods-empty"><strong>No custom foods yet</strong><span>Create one once, then reuse it here.</span></div>';
            return;
        }
        var html = '';
        for (var i = 0; i < builderMyFoods.length; i++) {
            var food = builderMyFoods[i];
            html += '<button type="button" class="meal-builder-my-food-item" onclick="chooseBuilderMyFood(' + i + ')">' +
                '<span class="meal-builder-result-icon" aria-hidden="true">&#9825;</span>' +
                '<span class="meal-builder-result-copy"><strong>' + escapeHtml(food.name || 'Custom food') + '</strong><small>' +
                escapeHtml(food.serving_label || '1 serving') + ' · ' + Math.round(parseFloat(food.calories) || 0) + ' calories' +
                (food.is_shared ? ' · Shared' : ' · Private') + '</small></span>' +
                '<span class="meal-builder-result-add" aria-label="Choose amount">+</span>' +
                '</button>';
        }
        list.innerHTML = html;
    }

    window.chooseBuilderMyFood = function (index) {
        var row = builderMyFoods[index];
        if (!row) return;
        closeBuilderMyFoods();
        showBuilderServingPicker(customFoodRowToSearchFood(row, row.is_shared ? 'balance-community-food' : 'custom-food'));
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
        // If the camera was cancelled (no meal came in), clear the
        // intercept flag so an unrelated save later doesn't get
        // diverted into the builder by mistake. We wait long enough
        // for the real intercept to fire first: _processSingleQuickMeal
        // runs on a separate visibilitychange handler, consumes the
        // flag, and routes the captured meal into the builder — so
        // by the time this timeout fires, either the flag is already
        // cleared (success) or no meal was produced (cancel).
        setTimeout(function () {
            window._builderInterceptNextQuickMeal = false;
        }, 3500);
    }
    document.addEventListener('visibilitychange', onWebViewResume);
    window.addEventListener('focus', function () {
        showBuilderAfterCamera();
        setTimeout(function () {
            drainPendingBuilderItems();
            drainPendingBuilderPhotos();
        }, 150);
        setTimeout(function () {
            window._builderInterceptNextQuickMeal = false;
        }, 3500);
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

    window.addBuilderItemViaTypedBarcode = function () {
        if (builderState.isAdding) return;
        var modal = document.getElementById('meal-builder-barcode-modal');
        var input = document.getElementById('meal-builder-barcode-input');
        var submit = document.getElementById('meal-builder-barcode-submit');
        var status = document.getElementById('meal-builder-barcode-status');
        if (!modal || !input || !submit) return;

        input.value = '';
        input.disabled = false;
        submit.disabled = true;
        submit.textContent = 'Look up & add';
        if (status) status.textContent = '';
        modal.classList.add('visible');
        setTimeout(function () { input.focus(); }, 150);
    };

    function closeBuilderBarcodeInput() {
        var modal = document.getElementById('meal-builder-barcode-modal');
        if (modal) modal.classList.remove('visible');
    }
    window.closeBuilderBarcodeInput = closeBuilderBarcodeInput;

    window.submitBuilderBarcodeItem = async function () {
        var input = document.getElementById('meal-builder-barcode-input');
        var submit = document.getElementById('meal-builder-barcode-submit');
        var status = document.getElementById('meal-builder-barcode-status');
        if (!input || !submit) return;

        var code = input.value.replace(/\D/g, '');
        input.value = code;
        if (code.length < 6) {
            if (status) status.textContent = 'Enter at least 6 digits.';
            return;
        }

        builderState.isAdding = true;
        updateSaveButtonState();
        input.disabled = true;
        submit.disabled = true;
        submit.textContent = 'Looking up...';
        if (status) status.textContent = 'Looking up product...';

        try {
            var response = await fetch('/.netlify/functions/barcode-lookup?code=' + encodeURIComponent(code));
            var result = await response.json().catch(function () { return null; });
            if (!response.ok || !result || !result.success || !result.product || !result.product.hasUsableNutrition) {
                throw new Error((result && result.error) || 'Product not found');
            }

            closeBuilderBarcodeInput();
            handleBuilderBarcodeProduct(result.product, 1, 'servings', 0);
        } catch (err) {
            console.error('Builder typed barcode lookup failed:', err);
            if (status) status.textContent = 'Product not found. Check the number or add it with Text.';
        } finally {
            builderState.isAdding = false;
            updateSaveButtonState();
            input.disabled = false;
            submit.textContent = 'Look up & add';
            submit.disabled = input.value.replace(/\D/g, '').length < 6;
        }
    };

    // Both the Photo and Barcode builder buttons go through this single
    // entry point. We call the exact same camera the homepage /
    // nutrition tab camera icon uses (openMealCameraDirect('widget')),
    // so users get the same camera experience regardless of which
    // button they tap — no special "builder" camera, no "legacy"
    // fallback, no forked code paths. A one-shot intercept flag tells
    // the regular meal-logging pipeline to route the analysed result
    // back into the open builder instead of logging it as a standalone
    // meal. Before the camera opens we drop the builder modal down
    // off-screen so the camera view is unobstructed; it slides back
    // up when the camera closes (or the capture is handed back).
    function openBuilderCamera() {
        if (builderState.isAdding) return;

        // One-shot flag: the very next meal that would otherwise be
        // saved as a standalone entry gets merged into this builder
        // instead. Cleared on intercept, on error, or when the
        // builder modal closes.
        window._builderInterceptNextQuickMeal = true;

        hideBuilderForCamera();

        if (typeof openMealCameraDirect === 'function') {
            try {
                // Use 'widget' as the source so we share the exact
                // same camera path as the homepage camera icon — on
                // native Android that opens QuickMealActivity, on iOS
                // the native file-input camera, on web the unified
                // in-WebView camera. The intercept flag re-routes the
                // resulting meal back into this builder on save.
                openMealCameraDirect('widget');
                return;
            } catch (e) {
                console.warn('openMealCameraDirect(widget) threw, falling back', e);
                window._builderInterceptNextQuickMeal = false;
                showBuilderAfterCamera();
            }
        }

        // Last-resort fallback — the old file-input path.
        if (typeof openCameraWithCallback === 'function') {
            window._builderInterceptNextQuickMeal = false;
            openCameraWithCallback(function (file) {
                handleBuilderPhotoFile(file);
            });
            return;
        }

        showBuilderAfterCamera();
        window._builderInterceptNextQuickMeal = false;
        showBuilderToast('Camera not available on this device.', 'error');
    }

    window.addBuilderItemViaPhoto = openBuilderCamera;
    window.addBuilderItemViaBarcode = openBuilderCamera;

    // Called by _processSingleQuickMeal / saveMealLogWithType in
    // script-11.js when the intercept flag is set — the meal that
    // would otherwise have been logged as a standalone entry is
    // handed off here and merged into the open builder as a new
    // ingredient. Also slides the builder modal back up so the user
    // can see their new item straight away.
    window._handleBuilderNativeQuickMeal = function (mealData) {
        showBuilderAfterCamera();
        try {
            // mealData can be the raw /analyze-food result (foodItems,
            // totals, micronutrients, ...) or the shape used by
            // saveMealLogWithType (same fields). Both are compatible
            // with mergeAnalysisIntoBuilder so we just pass it through.
            mergeAnalysisIntoBuilder({
                foodItems: mealData.foodItems || [],
                totals: mealData.totals || {},
                micronutrients: mealData.micronutrients || {},
                confidence: mealData.confidence || 'medium'
            });
            showBuilderToast('Item added!', 'success');
        } catch (e) {
            console.error('Builder native merge failed:', e);
            showBuilderToast('Could not add item. Try again.', 'error');
        }
    };

    // Is the meal builder modal currently open (either fully visible
    // or dropped down for a camera capture)? Script-11 checks this
    // before honouring the intercept flag so stray flags don't
    // accidentally divert an unrelated meal into a closed builder.
    window._isBuilderOpenForIntercept = function () {
        var modal = document.getElementById('meal-builder-modal');
        return !!(modal && modal.classList.contains('visible'));
    };

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
        var foodSearchInput = document.getElementById('meal-builder-food-search');
        if (foodSearchInput) {
            foodSearchInput.addEventListener('input', function () {
                clearTimeout(builderFoodSearchTimer);
                var query = foodSearchInput.value;
                builderFoodSearchTimer = setTimeout(function () { searchBuilderFoods(query); }, 350);
            });
            foodSearchInput.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    clearTimeout(builderFoodSearchTimer);
                    searchBuilderFoods(foodSearchInput.value);
                }
            });
        }

        var servingMeasure = document.getElementById('meal-builder-serving-measure');
        var servingCount = document.getElementById('meal-builder-serving-count');
        if (servingMeasure) servingMeasure.addEventListener('change', handleBuilderServingMeasureChange);
        if (servingCount) servingCount.addEventListener('input', updateBuilderServingPreview);

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

        var barcodeInput = document.getElementById('meal-builder-barcode-input');
        var barcodeSubmit = document.getElementById('meal-builder-barcode-submit');
        var barcodeStatus = document.getElementById('meal-builder-barcode-status');
        if (barcodeInput && barcodeSubmit) {
            barcodeInput.addEventListener('input', function () {
                var digits = barcodeInput.value.replace(/\D/g, '');
                barcodeSubmit.disabled = digits.length < 6;
                if (barcodeStatus) barcodeStatus.textContent = '';
            });
            barcodeInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !barcodeSubmit.disabled) {
                    e.preventDefault();
                    barcodeSubmit.click();
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
    // Save the built meal for later, or log it now as one combined meal.
    // Logging uses the normal meal pipeline so the existing Feed / Instagram
    // share prompt appears after the complete meal is saved.
    // ─────────────────────────────────────────────

    window.saveBuiltMeal = async function (options) {
        if (builderState.items.length === 0 || builderState.isAdding) return;

        var logNow = !!(options && options.logNow);

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

        var logBtn = document.getElementById('meal-builder-save-btn');
        var saveOnlyBtn = document.getElementById('meal-builder-save-only-btn');
        if (logBtn) logBtn.disabled = true;
        if (saveOnlyBtn) saveOnlyBtn.disabled = true;
        if (logNow && logBtn) logBtn.textContent = 'Logging meal...';
        if (!logNow && saveOnlyBtn) saveOnlyBtn.textContent = 'Saving...';

        try {
            if (logNow) {
                if (typeof saveMealLogWithType !== 'function') {
                    throw new Error('Meal logger is not ready yet');
                }

                // A camera or barcode launched from the builder normally clears
                // this one-shot flag itself. Clear it defensively so the finished
                // meal cannot be intercepted and added back into its own builder.
                window._builderInterceptNextQuickMeal = false;

                var mealType = typeof autoDetectMealType === 'function' ? autoDetectMealType() : 'snack';
                await saveMealLogWithType({
                    foodItems: builderState.items,
                    totals: builderState.totals,
                    micronutrients: builderState.micronutrients || {},
                    confidence: 'high',
                    inputMethod: 'builder',
                    mealType: mealType,
                    mealDescription: name.substring(0, 60),
                    notes: 'Built meal: ' + name.substring(0, 60)
                });
            } else {
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

                // Invalidate and refresh both saved-meal caches.
                window._savedMealsCache = null;
                refreshNativeSavedMealsCache();
            }

            closeMealBuilder();
            if (logNow) {
                try { if (typeof recalculateDailyNutrition === 'function') await recalculateDailyNutrition(); } catch (e) {}
                try { if (typeof loadTodayNutrition === 'function') await loadTodayNutrition(); } catch (e) {}
                try { if (typeof loadMicronutrientInsights === 'function') await loadMicronutrientInsights(); } catch (e) {}
                try { if (typeof checkMealBadges === 'function') checkMealBadges(); } catch (e) {}
                showBuilderToast('"' + name.substring(0, 30) + '" logged. Choose where to share below.', 'success');
            } else {
                showBuilderToast('"' + name.substring(0, 30) + '" saved for later!', 'success');
            }
        } catch (err) {
            console.error(logNow ? 'Error logging built meal:' : 'Error saving built meal:', err);
            showBuilderToast(logNow ? 'Could not log meal. Please try again.' : 'Could not save meal. Please try again.', 'error');
            updateSaveButtonState();
        } finally {
            if (logBtn) logBtn.textContent = 'Log meal';
            if (saveOnlyBtn) saveOnlyBtn.textContent = 'Save for later';
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
