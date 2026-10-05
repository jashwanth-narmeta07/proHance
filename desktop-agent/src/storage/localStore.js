const Store = require('electron-store');

/**
 * Two separate stores: 'config' for setup (backend URL, device token, user
 * info) and 'queue' for the offline event buffer (Section 31). Keeping them
 * separate means a queue-file bug can never corrupt the device credentials.
 *
 * Section 32: the device token lives only on this machine's disk, scoped to
 * this one device - never the organization's admin credentials, and it can
 * be revoked server-side at any time without touching anything else.
 */
const configStore = new Store({ name: 'agent-config' });
const queueStore = new Store({ name: 'agent-queue', defaults: { events: [] } });

function getConfig() {
  return {
    apiBaseUrl: configStore.get('apiBaseUrl', 'http://192.168.68.64:5000/api/v1'),
    deviceToken: configStore.get('deviceToken', null),
    deviceName: configStore.get('deviceName', null),
    userEmail: configStore.get('userEmail', null),
  };
}

function saveConfig({ apiBaseUrl, deviceToken, deviceName, userEmail }) {
  if (apiBaseUrl !== undefined) configStore.set('apiBaseUrl', apiBaseUrl);
  if (deviceToken !== undefined) configStore.set('deviceToken', deviceToken);
  if (deviceName !== undefined) configStore.set('deviceName', deviceName);
  if (userEmail !== undefined) configStore.set('userEmail', userEmail);
}

function clearConfig() {
  configStore.clear();
}

function isConfigured() {
  return !!configStore.get('deviceToken');
}

function enqueueEvent(event) {
  const events = queueStore.get('events', []);
  events.push(event);
  queueStore.set('events', events);
}

function peekQueue(limit = 50) {
  return queueStore.get('events', []).slice(0, limit);
}

function removeFromQueue(clientEventIds) {
  const idSet = new Set(clientEventIds);
  const remaining = queueStore.get('events', []).filter((e) => !idSet.has(e.clientEventId));
  queueStore.set('events', remaining);
}

function queueLength() {
  return queueStore.get('events', []).length;
}

module.exports = {
  getConfig,
  saveConfig,
  clearConfig,
  isConfigured,
  enqueueEvent,
  peekQueue,
  removeFromQueue,
  queueLength,
};
