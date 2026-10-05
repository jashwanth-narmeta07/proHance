const apiBaseUrlInput = document.getElementById('apiBaseUrl');
const deviceTokenInput = document.getElementById('deviceToken');
const deviceNameInput = document.getElementById('deviceName');
const testBtn = document.getElementById('testBtn');
const saveBtn = document.getElementById('saveBtn');
const statusEl = document.getElementById('status');

let connectionVerified = false;

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`;
}

window.agentBridge.getConfig().then((config) => {
  if (config.apiBaseUrl) apiBaseUrlInput.value = config.apiBaseUrl;
  if (config.deviceName) deviceNameInput.value = config.deviceName;
});

testBtn.addEventListener('click', async () => {
  testBtn.disabled = true;
  setStatus('Testing connection...', '');
  const result = await window.agentBridge.testConnection(apiBaseUrlInput.value.trim());
  testBtn.disabled = false;
  if (result.ok) {
    connectionVerified = true;
    setStatus('Connected - you can save and start the agent.', 'ok');
    saveBtn.disabled = !deviceTokenInput.value.trim();
  } else {
    connectionVerified = false;
    saveBtn.disabled = true;
    setStatus(`Could not reach the backend: ${result.error}`, 'error');
  }
});

deviceTokenInput.addEventListener('input', () => {
  saveBtn.disabled = !(connectionVerified && deviceTokenInput.value.trim());
});

saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  setStatus('Saving...', '');
  await window.agentBridge.saveSetup({
    apiBaseUrl: apiBaseUrlInput.value.trim(),
    deviceToken: deviceTokenInput.value.trim(),
    deviceName: deviceNameInput.value.trim() || 'Unnamed device',
  });
  // main.js closes this window and starts the agent once setup is saved.
});
