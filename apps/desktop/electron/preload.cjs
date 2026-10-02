const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  getCaptureSources: () => ipcRenderer.invoke('poker:get-capture-sources'),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('poker:set-always-on-top', flag),
  toggleOverlayMode: (enable) => ipcRenderer.invoke('poker:toggle-overlay-mode', enable),
  minimize: () => ipcRenderer.invoke('poker:minimize'),
  close: () => ipcRenderer.invoke('poker:close')
});
