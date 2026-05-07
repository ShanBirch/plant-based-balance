// ===== DAILY WEIGH-IN MODAL LOGIC (345 lines — deferred on iOS) =====

/**
 * Daily weigh-in auto-popup disabled. Users log weight from the home-screen card.
 */
async function checkAndShowWeighInModal() {
    return;
}

/**
 * Open the daily weigh-in modal
 */
async function openWeighInModal() {
    const modal = document.getElementById('weigh-in-modal');
    const inputSection = document.getElementById('weigh-in-modal-input-section');
    const successSection = document.getElementById('weigh-in-modal-success-section');
    const input = document.getElementById('weigh-in-modal-input');
    const unitLabel = document.getElementById('weigh-in-modal-unit-label');
    const lastWeightText = document.getElementById('weigh-in-modal-last-weight');

    if (!modal) return;

    // Reset modal state
    if (inputSection) inputSection.style.display = 'block';
    if (successSection) successSection.style.display = 'none';
    if (input) input.value = '';

    // Reset calliper section
    const bfInputs = document.getElementById('weigh-in-bf-inputs');
    const bfChevron = document.getElementById('weigh-in-bf-chevron');
    const bfResultRow = document.getElementById('bf-result-row');
    if (bfInputs) bfInputs.style.display = 'none';
    if (bfChevron) bfChevron.style.transform = '';
    if (bfResultRow) bfResultRow.style.display = 'none';
    ['bf-input-1','bf-input-2','bf-input-3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // Set unit preference
    const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';
    if (unitLabel) {
        unitLabel.textContent = preferLbs ? 'lbs' : 'kg';
    }
    if (input) {
        input.step = preferLbs ? '1' : '0.1';
    }

    // Show last known weight as reference
    try {
        const latestWeighIn = await db.weighIns.getLatest(window.currentUser.id);
        if (latestWeighIn && lastWeightText) {
            const displayWeight = preferLbs
                ? (latestWeighIn.weight_kg * 2.20462).toFixed(1) + ' lbs'
                : latestWeighIn.weight_kg.toFixed(1) + ' kg';
            lastWeightText.textContent = `Last weigh-in: ${displayWeight}`;
            lastWeightText.style.display = 'block';
        } else if (lastWeightText) {
            lastWeightText.style.display = 'none';
        }
    } catch (e) {
        if (lastWeightText) lastWeightText.style.display = 'none';
    }

    // Show modal
    modal.style.display = 'flex';
}

/**
 * Close the weigh-in modal
 */
function closeWeighInModal() {
    const modal = document.getElementById('weigh-in-modal');
    if (modal) modal.style.display = 'none';

    // Mark as prompted today even if skipped
    localStorage.setItem('lastWeighInPromptDate', new Date().toDateString());

    // Keep the dashboard card visible so user can still weigh in from the home screen
}

/**
 * Submit weight from the modal
 */
async function submitWeighInModal() {
    if (!window.currentUser) {
        alert('Please log in to track your weight.');
        return;
    }

    const input = document.getElementById('weigh-in-modal-input');
    const inputSection = document.getElementById('weigh-in-modal-input-section');
    const successSection = document.getElementById('weigh-in-modal-success-section');
    const modal = document.getElementById('weigh-in-modal');

    let weightValue = parseFloat(input?.value);

    if (!weightValue || weightValue < 20 || weightValue > 500) {
        alert('Please enter a valid weight.');
        return;
    }

    // Convert lbs to kg if needed
    const preferLbs = localStorage.getItem('weightUnitPreference') === 'lbs';
    if (preferLbs) {
        weightValue = weightValue * 0.453592;
    }

    // Capture body fat % if calliper section was used
    let bodyFatPct = null;
    const bfResult = document.getElementById('bf-result-value');
    const bfInputsVisible = document.getElementById('weigh-in-bf-inputs')?.style.display !== 'none';
    if (bfInputsVisible && bfResult && bfResult.textContent) {
        const parsed = parseFloat(bfResult.textContent);
        if (!isNaN(parsed) && parsed > 1 && parsed < 60) {
            bodyFatPct = parsed;
        }
    }

    try {
        // Log the weigh-in (with optional body fat %)
        const weighIn = await db.weighIns.log(window.currentUser.id, weightValue, null, bodyFatPct);
        if (typeof window.handlePostWeighInRewards === 'function') {
            await window.handlePostWeighInRewards(weighIn, { source: 'modal' });
        }

        // Update user's current weight in profile
        try {
            await db.users.update(window.currentUser.id, { weight: weightValue });
        } catch (updateError) {
            console.log('Profile weight update skipped:', updateError);
        }

        // Show success animation
        if (inputSection) inputSection.style.display = 'none';
        if (successSection) successSection.style.display = 'block';

        // Mark as prompted today
        localStorage.setItem('lastWeighInPromptDate', new Date().toDateString());

        // Hide the card on dashboard since already logged
        const card = document.getElementById('daily-weigh-in-card');
        if (card) card.style.display = 'none';

        // Close modal after showing success
        setTimeout(() => {
            if (modal) modal.style.display = 'none';
            // Reset for next use
            if (inputSection) inputSection.style.display = 'block';
            if (successSection) successSection.style.display = 'none';
            if (input) input.value = '';
        }, 2000);

        // Refresh points display
        if (typeof refreshPointsDisplay === 'function') {
            refreshPointsDisplay();
        }

    } catch (error) {
        console.error('Error logging weigh-in from modal:', error);
        alert('Failed to log weigh-in. Please try again.');
    }
}

// ===== BODY FAT CALLIPER HELPERS =====

/**
 * Toggle the body fat calliper section in the weigh-in modal.
 * Adapts the diagram and labels to the user's sex.
 */
function toggleBFSection() {
    const inputs = document.getElementById('weigh-in-bf-inputs');
    const chevron = document.getElementById('weigh-in-bf-chevron');
    if (!inputs) return;

    const isOpen = inputs.style.display !== 'none';
    inputs.style.display = isOpen ? 'none' : 'block';
    if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';

    if (!isOpen) {
        // Detect sex from session profile (set during login)
        let sex = 'male';
        try {
            const profile = JSON.parse(sessionStorage.getItem('userProfile') || '{}');
            sex = (profile.sex || '').toLowerCase().includes('f') ? 'female' : 'male';
        } catch (e) {}

        const maleDiagram  = document.getElementById('bf-diagram-male');
        const femaleDiagram = document.getElementById('bf-diagram-female');
        const maleSites    = document.getElementById('bf-sites-male');
        const femaleSites  = document.getElementById('bf-sites-female');
        const label1 = document.getElementById('bf-label-1');
        const label2 = document.getElementById('bf-label-2');
        const label3 = document.getElementById('bf-label-3');

        if (sex === 'female') {
            if (maleDiagram)  maleDiagram.style.display  = 'none';
            if (femaleDiagram) femaleDiagram.style.display = 'block';
            if (maleSites)    maleSites.style.display    = 'none';
            if (femaleSites)  femaleSites.style.display  = 'block';
            if (label1) label1.textContent = 'Tricep (mm)';
            if (label2) label2.textContent = 'Suprailiac (mm)';
            if (label3) label3.textContent = 'Thigh (mm)';
        } else {
            if (maleDiagram)  maleDiagram.style.display  = 'block';
            if (femaleDiagram) femaleDiagram.style.display = 'none';
            if (maleSites)    maleSites.style.display    = 'block';
            if (femaleSites)  femaleSites.style.display  = 'none';
            if (label1) label1.textContent = 'Chest (mm)';
            if (label2) label2.textContent = 'Abdomen (mm)';
            if (label3) label3.textContent = 'Thigh (mm)';
        }

        // Store sex on window for recalcBF()
        window._bfSex = sex;
    }
}

/**
 * Recalculate body fat % from the 3 skinfold inputs using Jackson-Pollock 3-site formula.
 * Male:   D = 1.10938 − (0.0008267×S) + (0.0000016×S²) − (0.0002574×age)
 * Female: D = 1.0994921 − (0.0009929×S) + (0.0000023×S²) − (0.0001392×age)
 * BF% = (4.95/D − 4.50) × 100
 */
function recalcBF() {
    const s1 = parseFloat(document.getElementById('bf-input-1')?.value) || 0;
    const s2 = parseFloat(document.getElementById('bf-input-2')?.value) || 0;
    const s3 = parseFloat(document.getElementById('bf-input-3')?.value) || 0;
    const resultRow = document.getElementById('bf-result-row');
    const resultVal = document.getElementById('bf-result-value');
    const resultCat = document.getElementById('bf-result-category');

    if (!s1 || !s2 || !s3) {
        if (resultRow) resultRow.style.display = 'none';
        return;
    }

    // Get age from session profile
    let age = 30;
    try {
        const profile = JSON.parse(sessionStorage.getItem('userProfile') || '{}');
        age = parseInt(profile.age) || 30;
    } catch (e) {}

    const S = s1 + s2 + s3;
    const sex = window._bfSex || 'male';
    let D;
    if (sex === 'female') {
        D = 1.0994921 - (0.0009929 * S) + (0.0000023 * S * S) - (0.0001392 * age);
    } else {
        D = 1.10938 - (0.0008267 * S) + (0.0000016 * S * S) - (0.0002574 * age);
    }

    const bf = ((4.95 / D) - 4.50) * 100;
    if (!isFinite(bf) || bf < 1 || bf > 60) {
        if (resultRow) resultRow.style.display = 'none';
        return;
    }

    if (resultVal) resultVal.textContent = bf.toFixed(1);
    if (resultRow) resultRow.style.display = 'block';

    // Category label (ACE classifications, male/female aware)
    if (resultCat) {
        let cat = '';
        if (sex === 'female') {
            if (bf < 14) cat = 'Essential fat';
            else if (bf < 21) cat = 'Athletic';
            else if (bf < 25) cat = 'Fitness';
            else if (bf < 32) cat = 'Average';
            else cat = 'Obese range';
        } else {
            if (bf < 6)  cat = 'Essential fat';
            else if (bf < 14) cat = 'Athletic';
            else if (bf < 18) cat = 'Fitness';
            else if (bf < 25) cat = 'Average';
            else cat = 'Obese range';
        }
        resultCat.textContent = cat;
    }
}

window.toggleBFSection = toggleBFSection;
window.recalcBF = recalcBF;

// Make functions globally available
window.checkAndShowWeighInModal = checkAndShowWeighInModal;
window.openWeighInModal = openWeighInModal;
window.closeWeighInModal = closeWeighInModal;
window.submitWeighInModal = submitWeighInModal;
