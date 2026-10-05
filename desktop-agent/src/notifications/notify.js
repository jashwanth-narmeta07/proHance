const { Notification } = require('electron');

function showIdleWarning(minutesUntilJustification) {
  if (!Notification.isSupported()) return;
  new Notification({
    title: 'Still there?',
    body: `You've been inactive for a few minutes. If this continues for ${minutesUntilJustification} more minute(s), you'll be asked what you were doing.`,
    silent: false,
  }).show();
}

function showAgentStatusNotification(message) {
  if (!Notification.isSupported()) return;
  new Notification({ title: 'Workforce SaaS Agent', body: message }).show();
}

module.exports = { showIdleWarning, showAgentStatusNotification };
