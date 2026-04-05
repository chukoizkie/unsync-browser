const { app, BrowserWindow, ipcMain } = require('electron');

if (require('electron-squirrel-startup')) app.quit();

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

  ipcMain.on('window-minimize', () => mainWindow.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window-close', () => mainWindow.close());
};

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
