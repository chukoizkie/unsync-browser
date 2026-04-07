const WebSocket = require('ws');

const SIGNAL_URL = 'wss://signal.unsync.uk';
const RELAY_URL  = 'wss://relay.unsync.uk';

let signalWs   = null;
let relayWs    = null;
let peerId     = null;
let connected  = false;
let mainWindow = null;

const pendingKnocks = new Map();

function init(window) {
  mainWindow = window;
}

function connect(identity) {
  peerId = identity.peerId;
  connectSignal();
  connectRelay();
}

function connectSignal() {
  signalWs = new WebSocket(SIGNAL_URL);

  signalWs.on('open', () => {
    connected = true;
    console.log('[mesh] signaling connected as', peerId);
    signalWs.send(JSON.stringify({ type: 'register', id: peerId, fcmToken: null }));
    notifyRenderer('mesh-status', { connected: true, peerId });
  });

  signalWs.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    handleSignalMessage(msg);
  });

  signalWs.on('close', () => {
    connected = false;
    notifyRenderer('mesh-status', { connected: false, peerId });
    console.log('[mesh] disconnected — retrying in 5s');
    setTimeout(connectSignal, 5000);
  });

  signalWs.on('error', (err) => {
    console.error('[mesh] error:', err.message);
  });
}

function connectRelay() {
  relayWs = new WebSocket(RELAY_URL);
  relayWs.on('open', () => {
    relayWs.send(JSON.stringify({ type: 'register', id: peerId }));
  });
  relayWs.on('close', () => setTimeout(connectRelay, 5000));
  relayWs.on('error', () => {});
}

function handleSignalMessage(msg) {
  // Knock response
  if (msg.type === 'knock_response' || msg.type === 'peer_offline') {
    const lookupKey = msg.targetId || msg.id || msg.to || msg.from;
    const knock = pendingKnocks.get(lookupKey);
    if (knock) {
      clearTimeout(knock.timeout);
      pendingKnocks.delete(lookupKey);
      knock.resolve({ online: msg.type === 'knock_response', peerId: msg.from || msg.targetId || msg.id });
    }
    // Also forward to renderer for MeshPage
    notifyRenderer('mesh-signal', msg);
    return;
  }

  // WebRTC signaling — forward straight to renderer
  if (['knock', 'offer', 'answer', 'ice'].includes(msg.type)) {
    notifyRenderer('mesh-signal', msg);
    return;
  }
}

// Send knock then offer from renderer
function sendSignal(msg) {
  if (!connected || !signalWs) return;
  signalWs.send(JSON.stringify(msg));
}

// Knock a peer — used by MeshPage before sending offer
function knock(targetPeerId) {
  return new Promise((resolve) => {
    if (!connected || !signalWs) return resolve({ online: false });

    const timeout = setTimeout(() => {
      pendingKnocks.delete(targetPeerId);
      resolve({ online: false });
    }, 8000);

    pendingKnocks.set(targetPeerId, { resolve, timeout });
    signalWs.send(JSON.stringify({ type: 'knock', from: peerId, to: targetPeerId }));
  });
}

function isConnected() { return connected; }
function getPeerId()   { return peerId; }

function notifyRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}


// Handle signaling-based resolve
function resolveHandle(targetHandle) {
  return new Promise((resolve) => {
    if (!connected || !signalWs) return resolve({ found: false });

    const timeout = setTimeout(() => {
      resolve({ found: false });
    }, 5000);

    const handler = (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if ((msg.type === 'resolved' || msg.type === 'resolve_failed') && msg.handle === targetHandle.toLowerCase()) {
        clearTimeout(timeout);
        signalWs.removeListener('message', handler);
        if (msg.type === 'resolved') {
          resolve({ found: true, peerId: msg.peerId });
        } else {
          resolve({ found: false });
        }
      }
    };

    signalWs.on('message', handler);
    signalWs.send(JSON.stringify({ type: 'resolve', handle: targetHandle }));
  });
}

module.exports = { init, connect, knock, sendSignal, resolveHandle, isConnected, getPeerId };
