const fs   = require('fs');
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

const IDENTITY_PATH = path.join(app.getPath('userData'), 'identity.json');

function generateIdentity(handle) {
  // Use Node's built-in crypto instead of node-forge for cross-platform compat
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

  const pubKeyBuffer  = publicKey.export({ type: 'spki', format: 'der' });
  const privKeyBuffer = privateKey.export({ type: 'pkcs8', format: 'der' });

  const hash   = crypto.createHash('sha256').update(pubKeyBuffer).digest('hex');
  const peerId = 'browser-' + hash.slice(0, 32);

  const identity = {
    handle,
    peerId,
    publicKey:  pubKeyBuffer.toString('base64'),
    privateKey: privKeyBuffer.toString('base64'),
    createdAt:  Date.now(),
  };

  fs.writeFileSync(IDENTITY_PATH, JSON.stringify(identity, null, 2));
  return identity;
}

function loadIdentity() {
  if (!fs.existsSync(IDENTITY_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(IDENTITY_PATH, 'utf8')); }
  catch { return null; }
}

module.exports = { generateIdentity, loadIdentity, IDENTITY_PATH };
