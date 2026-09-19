const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
const update = source.slice(source.indexOf('function updateWizardUI()'), source.indexOf('function calculateNutritionGoals('));
function setup() {
    function element(id) {
        const classes = new Set(), properties = new Map();
        return {id, offsetHeight: 400, scrollTop: 0, dataset: {}, style: {
            setProperty: (key, value) => properties.set(key, value),
            removeProperty: key => properties.delete(key),
            getPropertyValue: key => properties.get(key) || ''
        }, classList: {
            add: (...names) => names.forEach(name => classes.add(name)),
            remove: (...names) => names.forEach(name => classes.delete(name)),
            contains: name => classes.has(name),
            toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
        }};
    }
    const content = element('content'), overlay = element('onboarding-wizard');
    const slides = [1, 3, 4].map(n => element('slide-' + n));
    slides[0].classList.add('slide-active');
    const timers = new Map(); let nextTimer = 0;
    const context = vm.createContext({
        currentWizardStep: 4, totalWizardSteps: 19, finalWizardStep: 19,
        wizardSlideTransitionTimer: null, wizardSlideTransitionMs: 280, skippedWizardSlides: [],
        window: {}, normalizeWizardStep() {}, saveWizardCheckpoint() {}, closeOnboardingBlockingSurfaces() {},
        playWizardSectionTransition() {}, renderWizardStarterRoutineRecommendation() {},
        initializeWizardChatIntake() {}, syncWizardChatBackControls() {},
        document: {
            getElementById: id => id === overlay.id ? overlay : slides.find(slide => slide.id === id) || null,
            querySelector: selector => selector.includes('.slide-active') ? slides.find(slide => slide.classList.contains('slide-active')) : content,
            querySelectorAll: selector => selector.includes('.slide-exit') ? slides.filter(slide => slide.classList.contains('slide-exit')) : []
        },
        setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
        clearTimeout: id => timers.delete(id)
    });
    vm.runInContext(update, context);
    return { context, content, slides, render: () => context.updateWizardUI(), finish: () => { for (const callback of timers.values()) callback(); timers.clear(); } };
}
test('refresh during first training entrance releases scrolling without needing Back', () => {
    const { context, content, slides, render, finish } = setup();
    render();
    assert.equal(content.classList.contains('wizard-slide-transitioning'), true);
    render(); // Same-step refresh cancels the pending animation timer.
    finish();
    assert.equal(content.classList.contains('wizard-slide-transitioning'), false);
    assert.equal(content.style.getPropertyValue('--wizard-transition-height'), '');
    assert.equal(slides[0].style.display, 'none');
    content.scrollTop = 120;
    render();
    assert.equal(content.scrollTop, 120, 'refresh retains the member\'s reading position');
    assert.equal(context.currentWizardStep, 4);
});
test('normal, interrupted and returning transitions still finish on the selected slide', () => {
    for (const interrupt of [false, true]) {
        const { context, content, slides, render, finish } = setup();
        render();
        if (interrupt) { context.currentWizardStep = 3; render(); }
        finish();
        assert.equal(content.classList.contains('wizard-slide-transitioning'), false);
        context.currentWizardStep = 1; render(); finish();
        context.currentWizardStep = 4; render(); finish();
        assert.equal(content.classList.contains('wizard-slide-transitioning'), false);
        assert.equal(slides[2].classList.contains('slide-active'), true);
        assert.equal(slides[0].style.display, 'none');
    }
});
