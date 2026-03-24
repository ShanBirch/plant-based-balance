// Stub for userCycleData - will be overwritten with real data later
var userCycleData = {
    lastPeriod: null,
    cycleLength: 28,
    mood: null,
    noPeriodMode: false,
    symptoms: [],
    logs: {},
    dailyCheckIn: null
};

// Stub for switchAppTab - queues calls until real function loads
var _switchAppTabQueue = [];
var _switchAppTabReady = false;
function switchAppTab(tabName, btn) {
    if (_switchAppTabReady && typeof _switchAppTabReal === 'function') {
        return _switchAppTabReal(tabName, btn);
    }
    // Queue the call for when the real function is ready
    _switchAppTabQueue.push({ tabName, btn });
}

// Stub for syncQuizDataToDb - safe no-op until real function loads
var _syncQuizDataToDbReal = null;
async function syncQuizDataToDb() {
    if (typeof _syncQuizDataToDbReal === 'function') {
        return await _syncQuizDataToDbReal();
    }
    // Real function not loaded yet, silently skip
    console.log('syncQuizDataToDb: waiting for initialization...');
}

// Stub for loadProfileData - safe no-op until real function loads
var _loadProfileDataReal = null;
async function loadProfileData() {
    if (typeof _loadProfileDataReal === 'function') {
        return await _loadProfileDataReal();
    }
    // Real function not loaded yet, silently skip
    console.log('loadProfileData: waiting for initialization...');
}

// Stub for applyAppTheme - safe no-op until real function loads
var _applyAppThemeReal = null;
async function applyAppTheme(themeKey) {
    if (typeof _applyAppThemeReal === 'function') {
        return await _applyAppThemeReal(themeKey);
    }
    // Real function not loaded yet, silently skip
    console.log('applyAppTheme: waiting for initialization with theme:', themeKey);
}

// Stub for initProgramDate - safe no-op until script-5 loads (iOS deferred)
var _initProgramDateReal = null;
function initProgramDate() {
    if (typeof _initProgramDateReal === 'function') {
        return _initProgramDateReal();
    }
    window._pbbInitProgramDateDeferred = true;
}

// Stub for checkAndTriggerOnboarding - safe no-op until script-5 loads (iOS deferred)
var _checkAndTriggerOnboardingReal = null;
async function checkAndTriggerOnboarding() {
    if (typeof _checkAndTriggerOnboardingReal === 'function') {
        return await _checkAndTriggerOnboardingReal();
    }
    window._pbbCheckOnboardingDeferred = true;
}

// Stub for hideAllAppViews - safe no-op until script-5 loads (iOS deferred)
function hideAllAppViews() {
    if (typeof window._hideAllAppViewsReal === 'function') {
        return window._hideAllAppViewsReal();
    }
    // Fallback: hide all app-view divs
    var views = document.querySelectorAll('.app-view');
    for (var i = 0; i < views.length; i++) views[i].style.display = 'none';
}

// Stub for initCalendarView - safe no-op until script-5 loads (iOS deferred)
async function initCalendarView() {
    if (typeof window._initCalendarViewReal === 'function') {
        return await window._initCalendarViewReal();
    }
    window._pbbInitCalendarDeferred = true;
}