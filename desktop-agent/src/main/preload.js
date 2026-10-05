const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentBridge', {
  // Setup screen
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveSetup: (payload) => ipcRenderer.invoke('config:save-setup', payload),
  testConnection: (apiBaseUrl) => ipcRenderer.invoke('config:test-connection', apiBaseUrl),

  // Idle justification popup
  submitJustification: (payload) => ipcRenderer.invoke('idle:submit-justification', payload),
  onIdlePrompt: (callback) => ipcRenderer.on('idle:prompt', (_event, data) => callback(data)),

  // Status window
  getStatus: () => ipcRenderer.invoke('status:get'),
  onStatusUpdate: (callback) => ipcRenderer.on('status:update', (_event, data) => callback(data)),
});
