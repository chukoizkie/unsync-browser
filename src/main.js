const path = require('path');
const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const { generateIdentity, loadIdentity } = require('./identity');
const mesh          = require('./mesh');
const dht           = require('./dht');
const unsyncProto   = require('./unsync-protocol');
const contentServer = require('./content-server');

// Handle Squirrel events on Windows
if (process.platform === 'win32') {
  const squirrelCommand = process.argv[1];
  if ([
    '--squirrel-install',
    '--squirrel-updated', 
    '--squirrel-uninstall',
    '--squirrel-obsolete'
  ].includes(squirrelCommand)) {
    app.quit();
    process.exit(0);
  }
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'unsync', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#080808',
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      sandbox: false,
    },
  });

  mainWindow.loadURL(`file://${path.join(__dirname, "../dist/index.html")}`);
  mesh.init(mainWindow);
};

app.whenReady().then(async () => {
  unsyncProto.register();
  createWindow();

  // Window controls
  ipcMain.on('window-minimize', () => mainWindow.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window-close', () => mainWindow.close());

  // Identity
  ipcMain.handle('load-identity', () => loadIdentity());
  ipcMain.handle('create-identity', (_, handle) => {
    const identity = generateIdentity(handle);
    mesh.connect(identity);
    dht.init(identity.handle, identity.peerId);
    return identity;
  });

  // Mesh signaling bridge
  ipcMain.on('mesh-send',        (_, msg)          => mesh.sendSignal(msg));
  ipcMain.handle('mesh-knock',   (_, targetPeerId) => mesh.knock(targetPeerId));
  ipcMain.handle('get-peer-id',  ()                => mesh.getPeerId());
  ipcMain.handle('mesh-resolve-handle', (_, handle) => mesh.resolveHandle(handle));

  // DHT
  ipcMain.handle('dht-resolve',  (_, handle) => dht.resolve(handle));
  ipcMain.handle('dht-stats',    ()           => dht.stats());

  // Content server
  ipcMain.handle('serve-request', (_, { requestPath }) => {
    const identity = loadIdentity();
    if (!identity) return { status: 503, mime: 'text/plain', data: null, text: 'No identity' };
    const result = contentServer.serve(requestPath, identity);
    // Can't send Buffer over IPC directly — convert to base64
    return { status: result.status, mime: result.mime, data: result.data.toString('base64') };
  });
  ipcMain.handle('get-serve-dir', () => contentServer.getServeDir());

  // Auto-connect if identity exists
  const existing = loadIdentity();
  if (existing) {
    mesh.connect(existing);
    dht.init(existing.handle, existing.peerId);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
