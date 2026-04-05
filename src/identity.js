const forge = require('node-forge');
const fs    = require('fs');
const path  = require('path');
const { app } = require('electron');

const IDENTITY_PATH = path.join(app.getPath('userData'), 'identity.json');

function generatePeerId(publicKeyPem) {
  const md = forge.md.sha256.create();
  md.update(publicKeyPem);
  return 'browser-' + md.digest().toHex().slice(0, 32);
}

function generateIdentity(handle) {
  // Generate ed25519 keypair
  const keypair = forge.pki.ed25519.generateKeyPair();
  const publicKeyPem  = forge.pki.publicKeyToPem(
    forge.pki.setRsaPublicKey(keypair.publicKey)
  );

  // Use SHA256 of public key as stable peerId
  const md = forge.md.sha256.create();
  md.update(Buffer.from(keypair.publicKey).toString('binary'));
  const peerId = 'browser-' + md.digest().toHex().slice(0, 32);

  const identity = {
    handle,
    peerId,
    publicKey:  Buffer.from(keypair.publicKey).toString('base64'),
    privateKey: Buffer.from(keypair.privateKey).toString('base64'),
    createdAt:  Date.now(),
  };

  fs.writeFileSync(IDENTITY_PATH, JSON.stringify(identity, null, 2));
  return identity;
}

function loadIdentity() {
  if (!fs.existsSync(IDENTITY_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(IDENTITY_PATH, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = { generateIdentity, loadIdentity, IDENTITY_PATH };
