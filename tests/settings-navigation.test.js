const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const dashboard = read('dashboard.html');
const navigation = read('js/dashboard/pbb-settings-navigation.js');
const cancellation = read('cancellation.html');
const sw = read('sw.js');

test('every in-app Settings destination uses the shared navigation layer', () => {
  [
    'equipment', 'food', 'macros', 'cycle', 'battle', 'challenge',
    'character', 'health', 'addFriend', 'inviteFriend', 'password'
  ].forEach((key) => {
    assert.match(dashboard, new RegExp(`openSettingsDestination\\('${key}'\\)`), key);
    assert.match(navigation, new RegExp(`${key}: \\{`), key);
  });
  assert.match(dashboard, /onclick="openCancellationSettings\(\)"/);
});

test('all Settings sheets have a matching closer', () => {
  const expected = {
    'equipment-picker-overlay': 'closeEquipmentPicker',
    'dietary-picker-overlay': 'closeDietaryPicker',
    'calories-macro-actions-overlay': 'closeCaloriesAndMacroGoals',
    'macro-settings-modal-overlay': 'closeMacroSettingsModal',
    'recalculate-calories-wizard': 'closeRecalculateWizard',
    'cycle-tracking-modal': 'closeCycleTrackingModal',
    'feed-battle-chooser-overlay': 'closeFeedBattleChooser',
    'challenge-type-picker': 'closeChallengeTypePicker',
    'create-challenge-modal': 'closeCreateChallengeModal',
    'onboarding-wizard': 'closeCharacterCustomizationShortcut',
    'health-connect-modal': 'dismissHealthConnectModal',
    'add-friend-modal': 'closeAddFriendModal',
    'share-referral-modal': 'closeShareReferralModal',
    'change-password-modal-overlay': 'closeChangePasswordModal'
  };
  for (const [surface, closer] of Object.entries(expected)) {
    assert.match(navigation, new RegExp(`id: '${surface}', close: '${closer}'`), surface);
  }
});

test('phone back and both platform edge gestures close the active Settings sheet', () => {
  assert.match(navigation, /history\.pushState/);
  assert.match(navigation, /addEventListener\('popstate'/);
  assert.match(navigation, /event\.stopImmediatePropagation\(\)/);
  assert.match(navigation, /closeVisibleDestination\(\)/);
  assert.match(navigation, /platform === 'android' \? deltaX < -90 : deltaX > 90/);
  assert.match(navigation, /if \(isBack && deltaY < 90\) window\.history\.back\(\)/);
});

test('cancellation returns to Settings by button, browser history, swipe, or safe fallback', () => {
  assert.match(cancellation, /id="subscription-settings-back"/);
  assert.match(cancellation, /function returnToBalanceSettings\(\)/);
  assert.match(cancellation, /window\.history\.back\(\)/);
  assert.match(cancellation, /dashboard\.html\?tab=profile/);
  assert.match(cancellation, /enableCancellationSwipeBack/);
  assert.match(navigation, /cancellation\.html\?from=settings/);
});

test('the navigation layer is loaded and refreshed on returning phones', () => {
  assert.match(dashboard, /pbb-settings-navigation\.js\?v=1-settings-navigation/);
  assert.match(sw, /pbb-app-v438-insights-note-contrast/);
  assert.match(sw, /pbb-settings-navigation\.js\?v=1-settings-navigation/);
});

test('opening a Settings sheet creates one back step and popstate closes it', async () => {
  const windowListeners = {};
  const documentListeners = {};
  const equipment = {
    id: 'equipment-picker-overlay',
    isConnected: true,
    hidden: false,
    style: { display: 'none' },
    classList: { contains: () => false }
  };
  let pushes = 0;
  let backs = 0;
  let closes = 0;
  const document = {
    body: {},
    documentElement: { clientWidth: 390 },
    getElementById: (id) => id === equipment.id ? equipment : null,
    addEventListener(type, handler) {
      (documentListeners[type] ||= []).push(handler);
    }
  };
  const window = {
    innerWidth: 390,
    location: { href: 'https://example.test/dashboard.html' },
    history: {
      state: null,
      pushState(state) { this.state = state; pushes += 1; },
      back() { backs += 1; }
    },
    setTimeout,
    clearTimeout,
    getComputedStyle: (element) => ({ display: element.style.display }),
    addEventListener(type, handler) {
      (windowListeners[type] ||= []).push(handler);
    },
    openEquipmentPicker() { equipment.style.display = 'flex'; },
    closeEquipmentPicker() { equipment.style.display = 'none'; closes += 1; },
    alert() {}
  };
  window.window = window;
  class MutationObserver {
    observe() {}
    disconnect() {}
  }
  const navigator = { userAgent: 'iPhone' };
  vm.runInNewContext(navigation, {
    window,
    document,
    navigator,
    MutationObserver,
    console,
    Promise,
    Object,
    Date
  });

  window.openSettingsDestination('equipment');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(pushes, 1);
  assert.equal(equipment.style.display, 'flex');

  let intercepted = false;
  windowListeners.popstate[0]({ stopImmediatePropagation() { intercepted = true; } });
  assert.equal(intercepted, true);
  assert.equal(closes, 1);
  assert.equal(equipment.style.display, 'none');
  assert.equal(backs, 0);

  window.openSettingsDestination('equipment');
  await new Promise((resolve) => setTimeout(resolve, 10));
  documentListeners.touchstart[0]({ touches: [{ clientX: 10, clientY: 300 }] });
  documentListeners.touchend[0]({ changedTouches: [{ clientX: 120, clientY: 304 }] });
  assert.equal(backs, 1, 'iPhone left-edge swipe should request back');
  windowListeners.popstate[0]({ stopImmediatePropagation() {} });

  navigator.userAgent = 'Android';
  window.openSettingsDestination('equipment');
  await new Promise((resolve) => setTimeout(resolve, 10));
  documentListeners.touchstart[0]({ touches: [{ clientX: 385, clientY: 300 }] });
  documentListeners.touchend[0]({ changedTouches: [{ clientX: 280, clientY: 304 }] });
  assert.equal(backs, 2, 'Android right-edge swipe should request back');
  windowListeners.popstate[0]({ stopImmediatePropagation() {} });
});
