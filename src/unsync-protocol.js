const { protocol, net } = require('electron');
const mesh = require('./mesh');

// HTML pages returned for .unsync navigation
const page = (title, icon, color, body) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      background: #080808; color: #e8e8e8;
      font-family: 'Segoe UI', system-ui, sans-serif;
      display: flex; align-items: center; justify-content: center;
      height: 100vh; flex-direction: column; gap: 20px;
    }
    .icon  { font-size: 48px; }
    .title { font-size: 22px; font-weight: 700; color: ${color}; }
    .sub   { font-size: 13px; color: #555; font-family: monospace; }
    .badge {
      padding: 6px 14px; border-radius: 999px;
      border: 1px solid ${color}44; color: ${color};
      font-size: 11px; font-family: monospace; margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="icon">${icon}</div>
  <div class="title">${title}</div>
  ${body}
</body>
</html>`;

const resolvingPage = (handle) => page(
  'Resolving mesh address', '⬡', '#00ffcc',
  `<div class="sub">${handle}.unsync</div>
   <div class="badge">querying signaling server…</div>`
);

const onlinePage = (handle, peerId) => page(
  'Peer is online', '🟢', '#00ffcc',
  `<div class="sub">${handle}.unsync</div>
   <div class="badge">${peerId}</div>
   <div class="sub" style="margin-top:8px;color:#444">WebRTC connection — Week 3</div>`
);

const offlinePage = (handle) => page(
  'Peer is offline', '⬡', '#555',
  `<div class="sub">${handle}.unsync</div>
   <div class="badge" style="border-color:#33333388;color:#555">not reachable on mesh</div>`
);

const notConnectedPage = (handle) => page(
  'Mesh not connected', '⚠', '#ff6b35',
  `<div class="sub">${handle}.unsync</div>
   <div class="badge" style="border-color:#ff6b3544;color:#ff6b35">signaling server offline</div>`
);

function htmlResponse(html) {
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function register() {
  // Handle unsync:// protocol
  protocol.handle('unsync', async (request) => {
    const url    = new URL(request.url);
    const handle = url.hostname || url.pathname.replace(/^\/\//, '').split('/')[0];
    return await resolveHandle(handle);
  });
}

async function resolveHandle(handle) {
  if (!mesh.isConnected()) {
    return htmlResponse(notConnectedPage(handle));
  }

  // For now peerId = handle (in future: DHT lookup handle → peerId)
  // Convention: browser peers register as "browser-<hash>", 
  // for .unsync navigation we knock by handle directly and let
  // the signaling server match. Week 3 will add proper handle→peerId DHT.
  const targetPeerId = handle;

  const result = await mesh.knock(targetPeerId);

  if (result.online) {
    return htmlResponse(onlinePage(handle, result.peerId));
  } else {
    return htmlResponse(offlinePage(handle));
  }
}

// Called from main process when a webview tries to load a .unsync URL
async function resolveUnsyncUrl(handle) {
  return resolveHandle(handle);
}

module.exports = { register, resolveUnsyncUrl };
