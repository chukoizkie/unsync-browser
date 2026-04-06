const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose:    () => ipcRenderer.send('window-close'),

  // Identity
  createIdentity: (handle) => ipcRenderer.invoke('create-identity', handle),
  loadIdentity:   ()       => ipcRenderer.invoke('load-identity'),

  // Mesh status
  onMeshStatus:  (cb) => ipcRenderer.on('mesh-status',  (_, data) => cb(data)),
  onMeshKnock:   (cb) => ipcRenderer.on('mesh-knock',   (_, data) => cb(data)),

  // WebRTC signaling bridge
  meshSend:      (msg) => ipcRenderer.send('mesh-send', msg),
  onMeshSignal:  (cb)  => ipcRenderer.on('mesh-signal', (_, data) => cb(data)),
  meshKnock:     (targetPeerId) => ipcRenderer.invoke('mesh-knock', targetPeerId),
  getPeerId:     ()    => ipcRenderer.invoke('get-peer-id'),

  // DHT
  dhtResolve:    (handle) => ipcRenderer.invoke('dht-resolve', handle),
  dhtStats:      ()       => ipcRenderer.invoke('dht-stats'),
  onDhtUpdate:   (cb)     => ipcRenderer.on('dht-update', (_, data) => cb(data)),
});
