const connectionEl = document.getElementById('connection');
const trackingEl = document.getElementById('tracking');
const heartbeatEl = document.getElementById('heartbeat');
const pendingEl = document.getElementById('pending');
const pendingIdleEl = document.getElementById('pendingIdle');

function render(status) {
  connectionEl.innerHTML = status.connected
    ? '<span class="dot connected"></span>Connected'
    : '<span class="dot offline"></span>Offline';
  trackingEl.textContent = status.trackingActive ? 'Running' : 'Stopped';
  heartbeatEl.textContent = status.lastHeartbeatAt ? new Date(status.lastHeartbeatAt).toLocaleTimeString() : 'Never';
  pendingEl.textContent = status.pendingSync ?? 0;
  pendingIdleEl.textContent = status.pendingIdleJustification
    ? `Since ${new Date(status.pendingIdleJustification.startedAt).toLocaleTimeString()}`
    : 'None';
}

window.agentBridge.getStatus().then(render);
window.agentBridge.onStatusUpdate(render);
