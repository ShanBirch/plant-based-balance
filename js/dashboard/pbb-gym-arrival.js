(function(root) {
  'use strict';

  var PILOT_EMAIL = 'shannonbirch@cocospersonaltraining.com';
  var PILOT_USER_ID = '00a6605e-8edb-4917-85ba-24a23f179059';
  var STORAGE_KEY = 'balance_gym_arrival_v1';
  var STATE_KEY = 'balance_gym_arrival_state_v1';
  var GEOFENCE_ID = 'balance-shannon-gym-v1';
  var DEFAULT_RADIUS_METRES = 180;
  var EXIT_RADIUS_METRES = 350;
  var ARRIVAL_CARD_MS = 4 * 60 * 60 * 1000;
  var NOTIFICATION_ID = 38021;
  var listenerHandle = null;

  function isPilotUser(user) {
    user = user || root.currentUser || {};
    return String(user.id || '') === PILOT_USER_ID ||
      String(user.email || '').trim().toLowerCase() === PILOT_EMAIL;
  }

  function readJson(key, fallback) {
    try {
      var parsed = JSON.parse(root.localStorage.getItem(key) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { root.localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function getConfig() {
    var config = readJson(STORAGE_KEY, null);
    if (!config || config.enabled !== true) return null;
    if (!Number.isFinite(Number(config.latitude)) || !Number.isFinite(Number(config.longitude))) return null;
    return config;
  }

  function getState() {
    return readJson(STATE_KEY, {});
  }

  function toRadians(value) {
    return Number(value) * Math.PI / 180;
  }

  function distanceMetres(a, b) {
    var lat1 = toRadians(a.latitude);
    var lat2 = toRadians(b.latitude);
    var dLat = lat2 - lat1;
    var dLon = toRadians(Number(b.longitude) - Number(a.longitude));
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function getNativeGeofencePlugin() {
    return root.Capacitor && root.Capacitor.Plugins && root.Capacitor.Plugins.BackgroundGeolocation;
  }

  function getLocalNotificationsPlugin() {
    if (!root.Capacitor) return null;
    if (root.Capacitor.Plugins && root.Capacitor.Plugins.LocalNotifications) {
      return root.Capacitor.Plugins.LocalNotifications;
    }
    try {
      return typeof root.Capacitor.registerPlugin === 'function'
        ? root.Capacitor.registerPlugin('LocalNotifications')
        : null;
    } catch (_) {
      return null;
    }
  }

  function currentPosition(options) {
    options = options || {};
    return new Promise(function(resolve, reject) {
      if (!root.navigator || !root.navigator.geolocation) {
        reject(new Error('Location is not available on this device.'));
        return;
      }
      root.navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: options.highAccuracy !== false,
        timeout: options.timeout || 15000,
        maximumAge: options.maximumAge == null ? 30000 : options.maximumAge
      });
    });
  }

  function setSettingsStatus(text, tone) {
    var status = root.document && root.document.getElementById('gym-arrival-settings-status');
    var button = root.document && root.document.getElementById('gym-arrival-settings-btn');
    if (!status) return;
    status.textContent = text;
    status.style.color = tone === 'error' ? '#b91c1c' : 'var(--text-muted)';
    if (button) button.textContent = getConfig() ? 'Update' : 'Set here';
  }

  function updatePrivateVisibility() {
    if (!root.document) return;
    var setting = root.document.getElementById('settings-gym-arrival');
    if (setting) setting.style.display = isPilotUser() ? 'flex' : 'none';
    if (!isPilotUser()) {
      var card = root.document.getElementById('gym-arrival-card');
      if (card) card.style.display = 'none';
    }
  }

  function formatDistance(metres) {
    if (!Number.isFinite(metres)) return '';
    return metres < 1000 ? Math.max(1, Math.round(metres)) + ' m away' : (metres / 1000).toFixed(1) + ' km away';
  }

  function renderCard(mode, distance) {
    if (!root.document || !isPilotUser()) return;
    var card = root.document.getElementById('gym-arrival-card');
    var eyebrow = root.document.getElementById('gym-arrival-eyebrow');
    var title = root.document.getElementById('gym-arrival-title');
    var body = root.document.getElementById('gym-arrival-body');
    var primary = root.document.getElementById('gym-arrival-primary');
    var secondary = root.document.getElementById('gym-arrival-secondary');
    if (!card || !eyebrow || !title || !body || !primary || !secondary) return;

    if (mode === 'hidden') {
      card.style.display = 'none';
      return;
    }

    card.style.display = 'block';
    if (mode === 'setup') {
      eyebrow.textContent = 'Private pilot';
      title.textContent = 'Set up Gym Arrival';
      body.textContent = 'Do this once while you are at your gym. Balance will remember this spot on this phone.';
      primary.textContent = 'Use this location';
      primary.onclick = configureGymHere;
      secondary.style.display = 'none';
      return;
    }

    eyebrow.textContent = 'You are at the gym';
    title.textContent = 'Ready to train?';
    body.textContent = distance == null
      ? "Today's workout is ready when you are."
      : "Today's workout is ready. You're about " + formatDistance(distance) + '.';
    primary.textContent = 'Start workout';
    primary.onclick = openTodaysWorkout;
    secondary.style.display = 'inline-flex';
    secondary.textContent = 'Not today';
    secondary.onclick = dismissArrivalCard;
  }

  function renderFromStoredState() {
    updatePrivateVisibility();
    if (!isPilotUser()) return;
    var config = getConfig();
    if (!config) {
      setSettingsStatus('Set this once while you are at the gym');
      renderCard('setup');
      return;
    }
    setSettingsStatus('On for this phone');
    var state = getState();
    if (Number(state.arrivalUntil || 0) > Date.now() && state.dismissedArrivalId !== state.arrivalId) {
      renderCard('ready', Number.isFinite(Number(state.lastDistance)) ? Number(state.lastDistance) : null);
    } else {
      renderCard('hidden');
    }
  }

  async function registerNativeGeofence(config) {
    var plugin = getNativeGeofencePlugin();
    if (!plugin || typeof plugin.setupGeofencing !== 'function' || typeof plugin.addGeofence !== 'function') {
      return { native: false };
    }
    await plugin.setupGeofencing({
      notifyOnEntry: true,
      notifyOnExit: true,
      requestPermissions: true,
      backgroundLocation: false,
      payload: { feature: 'gym-arrival', userId: PILOT_USER_ID }
    });
    try { await plugin.removeGeofence({ identifier: GEOFENCE_ID }); } catch (_) {}
    await plugin.addGeofence({
      identifier: GEOFENCE_ID,
      latitude: Number(config.latitude),
      longitude: Number(config.longitude),
      radius: Number(config.radius || DEFAULT_RADIUS_METRES),
      notifyOnEntry: true,
      notifyOnExit: true,
      payload: { feature: 'gym-arrival' }
    });
    if (typeof plugin.getMonitoredGeofences === 'function') {
      var monitored = await plugin.getMonitoredGeofences();
      if (!monitored || !Array.isArray(monitored.regions) || monitored.regions.indexOf(GEOFENCE_ID) === -1) {
        throw new Error('The gym boundary could not be confirmed.');
      }
    }
    return { native: true };
  }

  async function requestNotificationPermission() {
    var notifications = getLocalNotificationsPlugin();
    if (!notifications || typeof notifications.requestPermissions !== 'function') return;
    try { await notifications.requestPermissions(); } catch (_) {}
  }

  async function configureGymHere() {
    if (!isPilotUser()) return false;
    var button = root.document && root.document.getElementById('gym-arrival-primary');
    if (button) { button.disabled = true; button.textContent = 'Finding you...'; }
    setSettingsStatus('Finding your current location');
    try {
      var position = await currentPosition({ highAccuracy: true, maximumAge: 0, timeout: 20000 });
      var accuracy = Number(position.coords.accuracy || 999);
      if (accuracy > 150) throw new Error('The location fix is too broad. Step outside and try once more.');
      var config = {
        enabled: true,
        label: 'Your gym',
        latitude: Number(position.coords.latitude),
        longitude: Number(position.coords.longitude),
        radius: DEFAULT_RADIUS_METRES,
        accuracy: accuracy,
        configuredAt: new Date().toISOString()
      };
      writeJson(STORAGE_KEY, config);
      var nativeResult = await registerNativeGeofence(config);
      await requestNotificationPermission();
      var arrivalId = String(Date.now());
      writeJson(STATE_KEY, {
        inside: true,
        arrivalId: arrivalId,
        arrivalUntil: Date.now() + ARRIVAL_CARD_MS,
        lastDistance: 0,
        lastCheckedAt: Date.now(),
        nativeGeofence: nativeResult.native
      });
      setSettingsStatus(nativeResult.native ? 'On for this phone' : 'On when Balance is open');
      renderCard('ready', 0);
      if (typeof root.showToast === 'function') root.showToast('Gym Arrival is on for this phone', 'success');
      return true;
    } catch (error) {
      setSettingsStatus(error && error.message ? error.message : 'Could not save this location', 'error');
      if (typeof root.showToast === 'function') root.showToast(error && error.message ? error.message : 'Could not save this location', 'error');
      renderFromStoredState();
      return false;
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function notifyArrival() {
    var notifications = getLocalNotificationsPlugin();
    if (!notifications || typeof notifications.schedule !== 'function') return;
    try {
      await notifications.schedule({
        notifications: [{
          id: NOTIFICATION_ID,
          title: 'Your workout is ready',
          body: 'At the gym? Tap to start today\'s workout in Balance.',
          schedule: { at: new Date(Date.now() + 750) },
          extra: { route: 'gym-arrival' }
        }]
      });
    } catch (error) {
      console.warn('[GymArrival] Could not show arrival notification:', error);
    }
  }

  function markArrival(options) {
    options = options || {};
    var state = getState();
    var wasInside = state.inside === true;
    var arrivalId = wasInside && state.arrivalId ? state.arrivalId : String(Date.now());
    state.inside = true;
    state.arrivalId = arrivalId;
    state.arrivalUntil = Date.now() + ARRIVAL_CARD_MS;
    state.lastCheckedAt = Date.now();
    if (Number.isFinite(Number(options.distance))) state.lastDistance = Number(options.distance);
    delete state.dismissedArrivalId;
    writeJson(STATE_KEY, state);
    renderCard('ready', Number.isFinite(Number(state.lastDistance)) ? Number(state.lastDistance) : null);
    if (!wasInside && options.notify !== false) notifyArrival();
  }

  function markOutside(distance) {
    var state = getState();
    state.inside = false;
    state.arrivalUntil = 0;
    state.lastDistance = distance;
    state.lastCheckedAt = Date.now();
    writeJson(STATE_KEY, state);
    renderCard('hidden');
  }

  async function checkProximityOnOpen() {
    if (!isPilotUser()) return false;
    var config = getConfig();
    if (!config) { renderFromStoredState(); return false; }
    try {
      var position = await currentPosition({ highAccuracy: false, maximumAge: 120000, timeout: 10000 });
      var distance = distanceMetres(config, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
      var state = getState();
      state.lastDistance = distance;
      state.lastCheckedAt = Date.now();
      writeJson(STATE_KEY, state);
      if (distance <= Number(config.radius || DEFAULT_RADIUS_METRES)) {
        markArrival({ distance: distance, notify: false });
        return true;
      }
      if (distance >= EXIT_RADIUS_METRES) markOutside(distance);
      else renderFromStoredState();
    } catch (error) {
      console.warn('[GymArrival] Proximity check skipped:', error && error.message ? error.message : error);
      renderFromStoredState();
    }
    return false;
  }

  async function attachNativeListeners() {
    var plugin = getNativeGeofencePlugin();
    if (!plugin || typeof plugin.addListener !== 'function' || listenerHandle) return;
    try {
      listenerHandle = await plugin.addListener('geofenceTransition', function(event) {
        if (!event || event.identifier !== GEOFENCE_ID) return;
        if (event.transition === 'enter' || event.enter === true) markArrival({ notify: true });
        if (event.transition === 'exit' || event.enter === false) markOutside(EXIT_RADIUS_METRES);
      });
    } catch (error) {
      console.warn('[GymArrival] Geofence listener unavailable:', error);
    }
  }

  async function repairNativeGeofence() {
    var config = getConfig();
    if (!config || !isPilotUser()) return;
    try {
      var result = await registerNativeGeofence(config);
      var state = getState();
      state.nativeGeofence = result.native;
      writeJson(STATE_KEY, state);
    } catch (error) {
      console.warn('[GymArrival] Native boundary could not be refreshed:', error);
    }
  }

  function dismissArrivalCard() {
    var state = getState();
    state.dismissedArrivalId = state.arrivalId || String(Date.now());
    writeJson(STATE_KEY, state);
    renderCard('hidden');
  }

  function openTodaysWorkout() {
    if (typeof root.switchAppTab === 'function') {
      root.switchAppTab('movement-tab', root.document && root.document.querySelector('.bottom-nav .nav-item[onclick*="movement-tab"]'));
    }
    var tries = 0;
    var timer = root.setInterval(function() {
      tries += 1;
      var card = root.document && root.document.getElementById('today-workout-card');
      if (card) {
        root.clearInterval(timer);
        card.click();
      } else if (tries >= 30) {
        root.clearInterval(timer);
        if (typeof root.showToast === 'function') root.showToast('Open your workout card in Movement', 'info');
      }
    }, 200);
  }

  async function registerNotificationTap() {
    var notifications = getLocalNotificationsPlugin();
    if (!notifications || typeof notifications.addListener !== 'function' || root.__gymArrivalNotificationListener) return;
    root.__gymArrivalNotificationListener = true;
    try {
      await notifications.addListener('localNotificationActionPerformed', function(event) {
        var extra = event && event.notification && event.notification.extra;
        if (extra && extra.route === 'gym-arrival') openTodaysWorkout();
      });
    } catch (_) {}
  }

  async function init() {
    updatePrivateVisibility();
    if (!isPilotUser()) return;
    renderFromStoredState();
    await attachNativeListeners();
    await registerNotificationTap();
    await checkProximityOnOpen();
    repairNativeGeofence();
  }

  root.isGymArrivalPilotUser = isPilotUser;
  root.configureGymArrivalHere = configureGymHere;
  root.checkGymArrivalNow = checkProximityOnOpen;
  root.dismissGymArrivalCard = dismissArrivalCard;
  root.openGymArrivalWorkout = openTodaysWorkout;
  root.BalanceGymArrival = {
    init: init,
    isPilotUser: isPilotUser,
    distanceMetres: distanceMetres,
    getConfig: getConfig,
    getState: getState
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { isPilotUser: isPilotUser, distanceMetres: distanceMetres };
  }

  if (root.document) {
    root.addEventListener('pbbInitComplete', function() { root.setTimeout(init, 700); }, { once: true });
    if (root.document.readyState === 'complete' && root.currentUser) root.setTimeout(init, 700);
  }
})(typeof window !== 'undefined' ? window : globalThis);
