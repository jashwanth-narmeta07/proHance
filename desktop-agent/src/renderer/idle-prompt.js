const titleEl = document.getElementById('title');
const hintEl = document.getElementById('hint');
const reasonSelect = document.getElementById('reason');
const otherWrap = document.getElementById('otherWrap');
const otherNote = document.getElementById('otherNote');
const submitBtn = document.getElementById('submitBtn');
const skipBtn = document.getElementById('skipBtn');

let currentWindow = null;
let tickTimer = null;

function formatWindow(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const minutes = Math.round((end - start) / 60000);
  return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })} (${minutes} min)`;
}

// currentWindow.startedAt never changes here - it's the real moment the
// employee went idle. currentWindow.endedAt is only a real end time when
// ongoing is false (the employee has already moved again, per idle-end in
// main.js); while ongoing is true it was just "now" at the moment this
// popup happened to open, so we recompute the displayed end time from the
// clock on every tick instead of leaving that stale snapshot on screen -
// otherwise a popup left open for 20 minutes would still claim "10 min".
function render() {
  if (!currentWindow) return;
  const displayEnd = currentWindow.ongoing ? new Date().toISOString() : currentWindow.endedAt;
  titleEl.textContent = `Inactive ${formatWindow(currentWindow.startedAt, displayEnd)}`;
}

function applyWindow(win) {
  currentWindow = win;
  reasonSelect.value = '';
  otherNote.value = '';
  otherWrap.style.display = 'none';
  submitBtn.disabled = true;

  clearInterval(tickTimer);
  tickTimer = null;
  render();
  if (win.ongoing) {
    // Every 15s is plenty for a display meant to be read in minutes, and
    // keeps this from doing any real work while the popup mostly just sits
    // there waiting for the employee to come back.
    tickTimer = setInterval(render, 15000);
  }
}

window.agentBridge.onIdlePrompt(applyWindow);

reasonSelect.addEventListener('change', () => {
  const isOther = reasonSelect.value === 'OTHER';
  otherWrap.style.display = isOther ? 'block' : 'none';
  submitBtn.disabled = !reasonSelect.value || (isOther && !otherNote.value.trim());
});

otherNote.addEventListener('input', () => {
  submitBtn.disabled = !otherNote.value.trim();
});

async function submit(reason, note) {
  if (!currentWindow) return;
  clearInterval(tickTimer);
  tickTimer = null;
  // If this window is still ongoing, the only accurate end time is right
  // now - the moment the employee actually interacted with the popup -
  // not whatever endedAt happened to be captured when the popup first
  // opened, which could be many minutes stale by the time they respond.
  const endedAt = currentWindow.ongoing ? new Date().toISOString() : currentWindow.endedAt;
  await window.agentBridge.submitJustification({
    startedAt: currentWindow.startedAt,
    endedAt,
    idleReason: reason || undefined,
    idleReasonNote: note || undefined,
  });
}

submitBtn.addEventListener('click', () => {
  submit(reasonSelect.value, reasonSelect.value === 'OTHER' ? otherNote.value.trim() : undefined);
});

// Section 14: no justification given -> stored as UNCLASSIFIED_IDLE, not
// auto-labeled unproductive. The employee can still classify it later from
// their activity history on the web dashboard.
skipBtn.addEventListener('click', () => {
  submit(undefined, undefined);
});