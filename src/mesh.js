const WebSocket = require('ws');

const SIGNAL_URL = 'wss://signal.unsync.uk';
const RELAY_URL  = 'wss://relay.unsync.uk';

let signalWs  = null;
let relayWs   = null;
let peerId    = null;
let connected = false;
let mainWindow = null;

const pendingKnocks = new Map(); // handle -> { resolve, reject, timeout }

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
    console.log('[mesh] signaling connected');

    // Same registration format as Unsync messenger
    signalWs.send(JSON.stringify({
      type:     'register',
      id:       peerId,
      fcmToken: null,
    }));

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
    console.log('[mesh] signaling disconnected — retrying in 5s');
    setTimeout(connectSignal, 5000);
  });

  signalWs.on('error', (err) => {
    console.error('[mesh] signaling error:', err.message);
  });
}

function connectRelay() {
  relayWs = new WebSocket(RELAY_URL);

  relayWs.on('open', () => {
    relayWs.send(JSON.stringify({ type: 'register', id: peerId }));
    console.log('[mesh] relay connected');
  });

  relayWs.on('close', () => {
    setTimeout(connectRelay, 5000);
  });

  relayWs.on('error', () => {}); // silent retry
}

function handleSignalMessage(msg) {
  // Knock response — peer found or offline
  if (msg.type === 'knock_response' || msg.type === 'peer_offline') {
    const knock = pendingKnocks.get(msg.targetId || msg.to);
    if (knock) {
      clearTimeout(knock.timeout);
      pendingKnocks.delete(msg.targetId || msg.to);
      knock.resolve({
        online: msg.type === 'knock_response',
        peerId: msg.targetId || msg.to,
      });
    }
  }

  // Incoming knock from another peer
  if (msg.type === 'knock') {
    notifyRenderer('mesh-knock', { from: msg.from });
  }
}

// Knock a .unsync handle's peerId — returns { online, peerId }
function knock(targetPeerId) {
  return new Promise((resolve, reject) => {
    if (!connected || !signalWs) {
      return resolve({ online: false, peerId: targetPeerId });
    }

    const timeout = setTimeout(() => {
      pendingKnocks.delete(targetPeerId);
      resolve({ online: false, peerId: targetPeerId });
    }, 8000);

    pendingKnocks.set(targetPeerId, { resolve, reject, timeout });

    signalWs.send(JSON.stringify({
      type: 'knock',
      from: peerId,
      to:   targetPeerId,
    }));
  });
}

function isConnected() { return connected; }
function getPeerId()   { return peerId; }

function notifyRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

module.exports = { init, connect, knock, isConnected, getPeerId };
