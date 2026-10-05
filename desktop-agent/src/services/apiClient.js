const axios = require('axios');
const os = require('os');
const { getConfig } = require('../storage/localStore.js');
const { version: agentVersion } = require('../../package.json');

function client() {
  const { apiBaseUrl, deviceToken } = getConfig();
  return axios.create({
    baseURL: apiBaseUrl,
    headers: deviceToken ? { 'X-Device-Token': deviceToken } : {},
    timeout: 15000,
  });
}

async function fetchAgentConfig() {
  const { data } = await client().get('/agent/config');
  return data.data;
}

/**
 * Sent on every heartbeat (every 60s, see main.js) rather than once at
 * setup - the laptop this agent runs on is the only thing that actually
 * knows its own OS, so this is what fills in the Devices page for
 * machines an admin registered remotely on someone else's behalf, where
 * the registering browser has no way to know what it's provisioning for.
 */
async function sendHeartbeat(isIdle = false, isCheckedIn = false) {
  const { data } = await client().post('/agent/heartbeat', {
    os: os.type(), // e.g. "Windows_NT", "Darwin", "Linux"
    osVersion: os.release(),
    agentVersion,
    isIdle,
    isCheckedIn,
  });
  return data.data;
}

/** Returns the per-event sync results so the caller can dequeue only the ones the server accepted. */
async function syncEvents(events) {
  const { data } = await client().post('/agent/sync', { events });
  return data.data.results;
}

module.exports = { fetchAgentConfig, sendHeartbeat, syncEvents };