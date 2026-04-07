const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose:    () => ipcRenderer.send('window-close'),

  // Identity
  createIdentity: (handle) => ipcRenderer.invoke('create-identity', handle),
  loadIdentity:   ()       => ipcRenderer.invoke('load-identity'),

  // Mesh
  onMeshStatus:  (cb) => ipcRenderer.on('mesh-status',  (_, d) => cb(d)),
  onMeshKnock:   (cb) => ipcRenderer.on('mesh-knock',   (_, d) => cb(d)),
  meshSend:      (msg) => ipcRenderer.send('mesh-send', msg),
  onMeshSignal:  (cb)  => ipcRenderer.on('mesh-signal', (_, d) => cb(d)),
  meshKnock:     (targetPeerId) => ipcRenderer.invoke('mesh-knock', targetPeerId),
  meshResolveHandle: (handle) => ipcRenderer.invoke('mesh-resolve-handle', handle),
  getPeerId:     () => ipcRenderer.invoke('get-peer-id'),

  // DHT
  dhtResolve:    (handle) => ipcRenderer.invoke('dht-resolve', handle),
  dhtStats:      ()       => ipcRenderer.invoke('dht-stats'),
  onDhtUpdate:   (cb)     => ipcRenderer.on('dht-update', (_, d) => cb(d)),

  // Content server
  serveRequest:  (requestPath) => ipcRenderer.invoke('serve-request', { requestPath }),
  getServeDir:   ()            => ipcRenderer.invoke('get-serve-dir'),
});
