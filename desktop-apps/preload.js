const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Events
  onNewChat: (callback) => ipcRenderer.on('new-chat', callback),
  onExportChat: (callback) => ipcRenderer.on('export-chat', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Platform info
  platform: process.platform,
  isDev: process.env.NODE_ENV === 'development'
});

// Handle window controls for macOS
if (process.platform === 'darwin') {
  contextBridge.exposeInMainWorld('windowControls', {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close')
  });
}
