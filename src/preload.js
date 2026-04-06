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

  // WebRTC signaling bridge
  // renderer → main → signaling server
  meshSend: (msg) => ipcRenderer.send('mesh-send', msg),
  // main → renderer (incoming signals)
  onMeshSignal: (cb) => ipcRenderer.on('mesh-signal', (_, data) => cb(data)),

  // Knock a peer (returns { online, peerId })
  meshKnock: (targetPeerId) => ipcRenderer.invoke('mesh-knock', targetPeerId),

  // Get own peerId
  getPeerId: () => ipcRenderer.invoke('get-peer-id'),
});
