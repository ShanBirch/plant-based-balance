/**
 * Fitness Tracker Integration Module
 * Handles connecting and syncing Fitbit and Garmin accounts
 */

window.fitnessTrackers = {
  /**
   * Initialize fitness tracker integrations
   */
  async init() {
    await this.loadIntegrations();
    this.setupEventListeners();
    this.checkForCallbackMessages();
  },

  /**
   * Load user's current integrations
   */
  async loadIntegrations() {
    try {
      const user = await auth.getUser();
      if (!user) return;

      const integrations = await db.fitnessIntegrations.getUserIntegrations(user.id);

      // Update UI for each integration
      this.updateIntegrationUI('fitbit', integrations.find(i => i.provider === 'fitbit'));
      this.updateIntegrationUI('garmin', integrations.find(i => i.provider === 'garmin'));

      // Load and display recent metrics
      await this.loadRecentMetrics(user.id);

    } catch (error) {
      console.error('Error loading integrations:', error);
    }
  },

  /**
   * Update UI for a specific integration
   */
  updateIntegrationUI(provider, integration) {
    const connectBtn = document.getElementById(`${provider}-connect-btn`);
    const disconnectBtn = document.getElementById(`${provider}-disconnect-btn`);
    const statusEl = document.getElementById(`${provider}-status`);
    const lastSyncEl = document.getElementById(`${provider}-last-sync`);

    if (!connectBtn) return; // UI not loaded yet

    if (integration && integration.is_active) {
      // Connected
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'inline-block';
      statusEl.textContent = '✓ Connected';
      statusEl.style.color = 'var(--primary)';

      if (integration.last_sync_at) {
        const lastSync = new Date(integration.last_sync_at);
        const timeAgo = this.getTimeAgo(lastSync);
        lastSyncEl.textContent = `Last synced ${timeAgo}`;
        lastSyncEl.style.display = 'block';
      }

      if (integration.last_error) {
        lastSyncEl.textContent = `Error: ${integration.last_error}`;
        lastSyncEl.style.color = '#ef4444';
      }
    } else {
      // Not connected
      connectBtn.style.display = 'inline-block';
      disconnectBtn.style.display = 'none';
      statusEl.textContent = 'Not connected';
      statusEl.style.color = 'var(--text-muted)';
      lastSyncEl.style.display = 'none';
    }
  },

  /**
   * Connect to Fitbit
   */
  async connectFitbit() {
    try {
      const user = await auth.getUser();
      if (!user) {
        alert('Please log in first');
        return;
      }

      // Redirect to Fitbit OAuth initiation
      window.location.href = `/.netlify/functions/fitbit-connect?userId=${user.id}`;
    } catch (error) {
      console.error('Error connecting Fitbit:', error);
      alert('Failed to connect to Fitbit. Please try again.');
    }
  },

  /**
   * Connect to Garmin
   */
  async connectGarmin() {
    try {
      const user = await auth.getUser();
      if (!user) {
        alert('Please log in first');
        return;
      }

      // Redirect to Garmin OAuth initiation
      window.location.href = `/.netlify/functions/garmin-connect?userId=${user.id}`;
    } catch (error) {
      console.error('Error connecting Garmin:', error);
      alert('Failed to connect to Garmin. Please try again.');
    }
  },

  /**
   * Disconnect a fitness tracker
   */
  async disconnect(provider) {
    try {
      const user = await auth.getUser();
      if (!user) return;

      const confirmMsg = `Are you sure you want to disconnect your ${provider === 'fitbit' ? 'Fitbit' : 'Garmin'} account?`;
      if (!confirm(confirmMsg)) return;

      await db.fitnessIntegrations.disconnect(user.id, provider);

      // Update UI
      this.updateIntegrationUI(provider, null);

      // Show success message
      this.showMessage(`${provider === 'fitbit' ? 'Fitbit' : 'Garmin'} disconnected successfully`);

    } catch (error) {
      console.error(`Error disconnecting ${provider}:`, error);
      alert('Failed to disconnect. Please try again.');
    }
  },

  /**
   * Manually trigger sync
   */
  async syncNow(provider) {
    try {
      const user = await auth.getUser();
      if (!user) return;

      const syncBtn = document.getElementById(`${provider}-sync-btn`);
      if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Syncing...';
      }

      const response = await fetch(`/.netlify/functions/${provider}-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          syncType: 'manual'
        })
      });

      const result = await response.json();

      if (response.ok) {
        this.showMessage(`${result.recordsSynced} records synced from ${provider === 'fitbit' ? 'Fitbit' : 'Garmin'}`);
        await this.loadIntegrations(); // Refresh UI
        await this.loadRecentMetrics(user.id); // Refresh metrics
      } else {
        throw new Error(result.message || 'Sync failed');
      }

    } catch (error) {
      console.error(`Error syncing ${provider}:`, error);
      alert('Sync failed. Please try again.');
    } finally {
      const syncBtn = document.getElementById(`${provider}-sync-btn`);
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Sync Now';
      }
    }
  },

  /**
   * Load and display recent metrics
   */
  async loadRecentMetrics(userId) {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const metrics = await db.fitnessMetrics.getByDateRange(userId, startDate, endDate);

      // Group metrics by date
      const metricsByDate = {};
      metrics.forEach(metric => {
        if (!metricsByDate[metric.metric_date]) {
          metricsByDate[metric.metric_date] = {};
        }
        metricsByDate[metric.metric_date][metric.metric_type] = metric;
      });

      // Display latest metrics summary
      const today = new Date().toISOString().split('T')[0];
      const todayMetrics = metricsByDate[today] || {};

      this.updateMetricDisplay('steps', todayMetrics.steps);
      this.updateMetricDisplay('calories', todayMetrics.calories);
      this.updateMetricDisplay('sleep', todayMetrics.sleep_minutes);
      this.updateMetricDisplay('heart_rate', todayMetrics.heart_rate_resting);

    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  },

  /**
   * Update metric display in UI
   */
  updateMetricDisplay(metricType, metric) {
    const el = document.getElementById(`metric-${metricType}`);
    if (!el) return;

    if (metric) {
      let value;
      if (metric.value_integer !== null) {
        value = metric.value_integer.toLocaleString();
      } else if (metric.value_decimal !== null) {
        value = parseFloat(metric.value_decimal).toLocaleString();
      } else {
        value = '-';
      }

      el.textContent = `${value} ${metric.unit || ''}`;
      el.style.color = 'var(--primary)';
    } else {
      el.textContent = '-';
      el.style.color = 'var(--text-muted)';
    }
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Fitbit
    const fitbitConnectBtn = document.getElementById('fitbit-connect-btn');
    if (fitbitConnectBtn) {
      fitbitConnectBtn.addEventListener('click', () => this.connectFitbit());
    }

    const fitbitDisconnectBtn = document.getElementById('fitbit-disconnect-btn');
    if (fitbitDisconnectBtn) {
      fitbitDisconnectBtn.addEventListener('click', () => this.disconnect('fitbit'));
    }

    const fitbitSyncBtn = document.getElementById('fitbit-sync-btn');
    if (fitbitSyncBtn) {
      fitbitSyncBtn.addEventListener('click', () => this.syncNow('fitbit'));
    }

    // Garmin
    const garminConnectBtn = document.getElementById('garmin-connect-btn');
    if (garminConnectBtn) {
      garminConnectBtn.addEventListener('click', () => this.connectGarmin());
    }

    const garminDisconnectBtn = document.getElementById('garmin-disconnect-btn');
    if (garminDisconnectBtn) {
      garminDisconnectBtn.addEventListener('click', () => this.disconnect('garmin'));
    }

    const garminSyncBtn = document.getElementById('garmin-sync-btn');
    if (garminSyncBtn) {
      garminSyncBtn.addEventListener('click', () => this.syncNow('garmin'));
    }
  },

  /**
   * Check for OAuth callback messages
   */
  checkForCallbackMessages() {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (success) {
      if (success === 'fitbit_connected') {
        this.showMessage('Fitbit connected successfully! Syncing your data...');
      } else if (success === 'garmin_connected') {
        this.showMessage('Garmin connected successfully! Syncing your data...');
      }

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);

      // Reload integrations
      setTimeout(() => this.loadIntegrations(), 1000);
    }

    if (error) {
      let errorMsg = 'Connection failed. Please try again.';
      if (error.includes('fitbit')) {
        errorMsg = 'Fitbit connection failed. Please try again.';
      } else if (error.includes('garmin')) {
        errorMsg = 'Garmin connection failed. Please try again.';
      }

      alert(errorMsg);

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  },

  /**
   * Show a success message
   */
  showMessage(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--primary);
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-size: 0.9rem;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.remove();
    }, 3000);
  },

  /**
   * Get human-readable time ago string
   */
  getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

    return date.toLocaleDateString();
  }
};

// Auto-initialize when included in a page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => window.fitnessTrackers.init(), 500);
  });
} else {
  setTimeout(() => window.fitnessTrackers.init(), 500);
}
