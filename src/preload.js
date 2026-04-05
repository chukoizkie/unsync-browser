const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose:    () => ipcRenderer.send('window-close'),

  // Identity
  createIdentity: (handle) => ipcRenderer.invoke('create-identity', handle),
  loadIdentity:   ()       => ipcRenderer.invoke('load-identity'),

  // Mesh status (push from main)
  onMeshStatus: (cb) => ipcRenderer.on('mesh-status', (_, data) => cb(data)),
  onMeshKnock:  (cb) => ipcRenderer.on('mesh-knock',  (_, data) => cb(data)),
});
