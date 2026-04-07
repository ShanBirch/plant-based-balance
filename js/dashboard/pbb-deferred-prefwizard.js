// ============================================================
// PREFERENCE WIZARD LOGIC (253 lines — deferred on iOS)
// ============================================================

let prefWizardState = {
    currentStep: 1,
    totalSteps: 3,
    planSlug: null,
    preferences: {
        diet: null,
        allergies: [],
        cookingTime: null
    }
};

function openPreferenceWizard(planSlug) {
    prefWizardState = {
        currentStep: 1,
        totalSteps: 3,
        planSlug: planSlug,
        preferences: {
            diet: null,
            allergies: [],
            cookingTime: null
        }
    };

    // Update title with plan name
    const planNames = {
        'summer-shred': 'Summer Shred',
        'clean-bulk': 'Clean Bulk',
        'energy-boost': 'Energy Boost',
        'gut-reset': 'Gut Reset',
        'quick-easy': 'Quick & Easy'
    };
    document.getElementById('pref-wizard-title').textContent = planNames[planSlug] || 'Customize Your Plan';

    // Reset UI
    updatePrefWizardStep(1);
    clearPrefSelections();

    // Show modal
    document.getElementById('pref-wizard-overlay').classList.add('active');
}

function closePrefWizard() {
    document.getElementById('pref-wizard-overlay').classList.remove('active');
}

function updatePrefWizardStep(step) {
    prefWizardState.currentStep = step;

    // Update step dots
    document.querySelectorAll('.pref-wizard-progress .step-dot').forEach(dot => {
        const dotStep = parseInt(dot.dataset.step);
        dot.classList.remove('active', 'completed');
        if (dotStep === step) {
            dot.classList.add('active');
        } else if (dotStep < step) {
            dot.classList.add('completed');
        }
    });

    // Update step content
    document.querySelectorAll('.pref-wizard-step').forEach(stepEl => {
        stepEl.classList.remove('active');
        if (parseInt(stepEl.dataset.step) === step) {
            stepEl.classList.add('active');
        }
    });

    // Update buttons
    const backBtn = document.getElementById('pref-wizard-back');
    const nextBtn = document.getElementById('pref-wizard-next');

    backBtn.style.visibility = step === 1 ? 'hidden' : 'visible';
    nextBtn.textContent = step === prefWizardState.totalSteps ? 'Continue to Checkout' : 'Next';

    // Update next button state
    updatePrefNextButton();
}

function updatePrefNextButton() {
    const nextBtn = document.getElementById('pref-wizard-next');
    const step = prefWizardState.currentStep;

    let isValid = false;
    if (step === 1) {
        isValid = prefWizardState.preferences.diet !== null;
    } else if (step === 2) {
        isValid = true; // Allergies are optional
    } else if (step === 3) {
        isValid = prefWizardState.preferences.cookingTime !== null;
    }

    nextBtn.disabled = !isValid;
}

function selectPrefOption(el, type) {
    // Remove selected from siblings
    el.parentElement.querySelectorAll('.pref-option').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');

    // Store value
    if (type === 'diet') {
        prefWizardState.preferences.diet = el.dataset.value;
    } else if (type === 'time') {
        prefWizardState.preferences.cookingTime = el.dataset.value;
    }

    updatePrefNextButton();
}

function togglePrefCheckbox(el) {
    el.classList.toggle('selected');

    // Update allergies array
    const value = el.dataset.value;
    const idx = prefWizardState.preferences.allergies.indexOf(value);
    if (idx > -1) {
        prefWizardState.preferences.allergies.splice(idx, 1);
    } else {
        prefWizardState.preferences.allergies.push(value);
    }
}

function clearPrefSelections() {
    document.querySelectorAll('.pref-option, .pref-checkbox').forEach(el => el.classList.remove('selected'));
}

function prefWizardBack() {
    if (prefWizardState.currentStep > 1) {
        updatePrefWizardStep(prefWizardState.currentStep - 1);
    }
}

function prefWizardNext() {
    if (prefWizardState.currentStep < prefWizardState.totalSteps) {
        updatePrefWizardStep(prefWizardState.currentStep + 1);
    } else {
        // Complete - proceed to checkout
        completePrefWizard();
    }
}

function completePrefWizard() {
    // Store preferences
    localStorage.setItem('selected_meal_plan', prefWizardState.planSlug);
    localStorage.setItem('user_food_preferences', JSON.stringify(prefWizardState.preferences));

    closePrefWizard();

    // Proceed to Stripe checkout
    initiateMealPlanCheckout(prefWizardState.planSlug, prefWizardState.preferences);
}

async function initiateMealPlanCheckout(planSlug, preferences) {
    // Native app (App Store / Play Store): use IAP
    if (window.Platform && window.Platform.isNative()) {
        try {
            const result = await purchaseMealPlan(planSlug, preferences);
            if (result && !result.cancelled) {
                showToast('Meal plan unlocked!', 'success');
            }
        } catch (error) {
            console.error('IAP meal plan error:', error);
            alert('Purchase failed. Please try again.');
        }
        return;
    }

    // Web (website): use Stripe
    // Show loading state
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'checkout-loading';
    loadingDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10001;';
    loadingDiv.innerHTML = `
        <div style="background: white; padding: 40px; border-radius: 16px; text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 15px;">🍽️</div>
            <p style="color: var(--primary); font-weight: 600;">Preparing your checkout...</p>
        </div>
    `;
    document.body.appendChild(loadingDiv);

    try {
        // Get user email if logged in
        const userEmail = window.currentUser?.email || localStorage.getItem('user_email') || null;
        const userId = window.currentUser?.id || localStorage.getItem('user_id') || null;

        // Call the Stripe checkout endpoint
        const response = await fetch('/api/create-meal-plan-checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                planSlug: planSlug,
                email: userEmail,
                userId: userId,
                preferences: preferences
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to create checkout session');
        }

        // Remove loading
        loadingDiv.remove();

        // Redirect to Stripe checkout
        if (data.url) {
            // Direct URL redirect (preferred)
            window.location.href = data.url;
        } else if (data.sessionId) {
            // Use Stripe.js to redirect (fallback)
            const stripe = Stripe(window.STRIPE_PUBLIC_KEY || 'pk_live_your_key');
            await stripe.redirectToCheckout({ sessionId: data.sessionId });
        } else {
            throw new Error('No checkout URL returned');
        }

    } catch (error) {
        loadingDiv.remove();
        console.error('Checkout error:', error);

        // For development/demo: Allow fallback to demo mode
        if (confirm(`Checkout error: ${error.message}\n\nWould you like to continue in demo mode? (This will simulate a purchase)`)) {
            // Demo mode - mark as purchased locally
            let purchased = [];
            try { purchased = JSON.parse(localStorage.getItem('purchased_meal_plans') || '[]'); } catch(e) {}
            if (!purchased.includes(planSlug)) {
                purchased.push(planSlug);
                localStorage.setItem('purchased_meal_plans', JSON.stringify(purchased));
            }
            localStorage.setItem('user_food_preferences', JSON.stringify(preferences));

            alert('Demo purchase successful! Refreshing your meal plan view...');
            initializeMealPlanView();
        }
    }
}

// Close wizard on overlay click
document.getElementById('pref-wizard-overlay')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closePrefWizard();
    }
});