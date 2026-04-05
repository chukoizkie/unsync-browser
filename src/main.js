const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const { generateIdentity, loadIdentity } = require('./identity');
const mesh        = require('./mesh');
const unsyncProto = require('./unsync-protocol');

if (require('electron-squirrel-startup')) app.quit();

// Register unsync:// as a privileged scheme before app is ready
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
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      sandbox: false,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mesh.init(mainWindow);
};

app.whenReady().then(async () => {
  // Register .unsync protocol handler
  unsyncProto.register();

  createWindow();

  // IPC: window controls
  ipcMain.on('window-minimize', () => mainWindow.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window-close', () => mainWindow.close());

  // IPC: identity
  ipcMain.handle('load-identity',    ()       => loadIdentity());
  ipcMain.handle('create-identity',  (_, handle) => {
    const identity = generateIdentity(handle);
    // Connect to mesh immediately after identity creation
    mesh.connect(identity);
    return identity;
  });

  // Auto-connect if identity already exists
  const existing = loadIdentity();
  if (existing) {
    mesh.connect(existing);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
