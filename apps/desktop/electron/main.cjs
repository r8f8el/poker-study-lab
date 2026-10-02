const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');

let mainWindow = null;
let isOverlayMode = false;
let savedNormalBounds = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    title: 'Poker Study Lab — Live Desktop Assistant',
    backgroundColor: '#090d16',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const fs = require('fs');
  const distPath = path.join(__dirname, '../../../dist/index.html');

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL).catch(() => {
      if (fs.existsSync(distPath)) mainWindow.loadFile(distPath);
    });
  } else if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      if (fs.existsSync(distPath)) mainWindow.loadFile(distPath);
    });
  }

  mainWindow.webContents.on('did-fail-load', () => {
    if (fs.existsSync(distPath)) {
      mainWindow.loadFile(distPath);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: Native window capture source enumeration
ipcMain.handle('poker:get-capture-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true
    });

    return sources.map(source => ({
      id: source.id,
      name: source.name,
      display_id: source.display_id,
      thumbnail: source.thumbnail.toDataURL(),
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }));
  } catch (err) {
    console.error('[Electron Main] Failed to get capture sources:', err);
    return [];
  }
});

// IPC: Toggle Always-On-Top
ipcMain.handle('poker:set-always-on-top', (_event, flag) => {
  if (!mainWindow) return false;
  mainWindow.setAlwaysOnTop(Boolean(flag), 'screen-saver');
  return mainWindow.isAlwaysOnTop();
});

// IPC: Toggle Compact Overlay HUD Mode
ipcMain.handle('poker:toggle-overlay-mode', (_event, enable) => {
  if (!mainWindow) return false;

  if (enable && !isOverlayMode) {
    savedNormalBounds = mainWindow.getBounds();
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setSize(520, 680);
    isOverlayMode = true;
  } else if (!enable && isOverlayMode) {
    mainWindow.setAlwaysOnTop(false);
    if (savedNormalBounds) {
      mainWindow.setBounds(savedNormalBounds);
    } else {
      mainWindow.setSize(1440, 900);
    }
    isOverlayMode = false;
  }

  return isOverlayMode;
});

// Window controls
ipcMain.handle('poker:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('poker:close', () => {
  mainWindow?.close();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
