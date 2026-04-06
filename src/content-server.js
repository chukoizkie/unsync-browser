const fs   = require('fs');
const path = require('path');
const { app } = require('electron');

const SERVE_DIR = path.join(app.getPath('userData'), 'serve');

// Ensure serve directory exists
function ensureServeDir() {
  if (!fs.existsSync(SERVE_DIR)) {
    fs.mkdirSync(SERVE_DIR, { recursive: true });
  }
  return SERVE_DIR;
}

// MIME types
const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.txt':  'text/plain',
};

// Generate identity card HTML
function identityCard(identity) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>@${identity.handle} · UnSync</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Syne:wght@400;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #080808; color: #e8e8e8;
      font-family: 'Syne', system-ui, sans-serif;
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .card {
      width: 480px; padding: 48px;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      background: #0d0d0d;
      box-shadow: 0 32px 80px rgba(0,0,0,0.8);
    }
    .mesh-icon {
      width: 48px; height: 48px; margin-bottom: 32px;
    }
    .handle {
      font-size: 32px; font-weight: 700;
      color: #00ffcc; letter-spacing: -0.02em;
      margin-bottom: 4px;
    }
    .subtitle {
      font-size: 13px; color: #555;
      font-family: 'JetBrains Mono', monospace;
      margin-bottom: 32px;
    }
    .divider {
      height: 1px; background: rgba(255,255,255,0.06);
      margin: 24px 0;
    }
    .field { margin-bottom: 16px; }
    .field-label {
      font-size: 10px; color: #444;
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase; letter-spacing: 0.1em;
      margin-bottom: 4px;
    }
    .field-value {
      font-size: 12px; color: #888;
      font-family: 'JetBrains Mono', monospace;
      word-break: break-all;
    }
    .badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 999px;
      border: 1px solid rgba(0,255,204,0.2);
      color: #00ffcc; font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      margin-top: 24px;
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: #00ffcc; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  </style>
</head>
<body>
  <div class="card">
    <svg class="mesh-icon" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="6" fill="#00ffcc" opacity="0.9"/>
      <circle cx="6"  cy="6"  r="4" fill="#64c8ff" opacity="0.5"/>
      <circle cx="42" cy="6"  r="4" fill="#64c8ff" opacity="0.5"/>
      <circle cx="6"  cy="42" r="4" fill="#64c8ff" opacity="0.5"/>
      <circle cx="42" cy="42" r="4" fill="#64c8ff" opacity="0.5"/>
      <path d="M9 9L19 19M39 9L29 19M9 39L19 29M39 39L29 29" stroke="#64c8ff" strokeWidth="1.2" opacity="0.3"/>
    </svg>

    <div class="handle">@${identity.handle}</div>
    <div class="subtitle">unsync mesh node · ${identity.handle}.unsync</div>

    <div class="divider"></div>

    <div class="field">
      <div class="field-label">Peer ID</div>
      <div class="field-value">${identity.peerId}</div>
    </div>

    <div class="field">
      <div class="field-label">Public Key</div>
      <div class="field-value">${identity.publicKey?.slice(0, 48)}…</div>
    </div>

    <div class="field">
      <div class="field-label">Node Type</div>
      <div class="field-value">UnSync Browser · mesh-native</div>
    </div>

    <div class="field">
      <div class="field-label">Member Since</div>
      <div class="field-value">${new Date(identity.createdAt).toUTCString()}</div>
    </div>

    <div class="badge">
      <div class="dot"></div>
      live P2P connection · no servers
    </div>
  </div>
</body>
</html>`;
}

// Serve a request — returns { mime, data (Buffer), status }
function serve(requestPath, identity) {
  ensureServeDir();

  // Normalize path
  let filePath = requestPath === '/' ? '/index.html' : requestPath;
  // Security: prevent directory traversal
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(SERVE_DIR, filePath);

  // Try to serve the file
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const ext  = path.extname(fullPath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const data = fs.readFileSync(fullPath);
    return { status: 200, mime, data };
  }

  // Fallback: identity card
  if (requestPath === '/' || requestPath === '/index.html') {
    return {
      status: 200,
      mime:   'text/html',
      data:   Buffer.from(identityCard(identity)),
    };
  }

  return { status: 404, mime: 'text/plain', data: Buffer.from('not found') };
}

function getServeDir() { return ensureServeDir(); }

module.exports = { serve, getServeDir, identityCard };
