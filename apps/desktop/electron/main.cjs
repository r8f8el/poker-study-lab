const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let isOverlayMode = false;
let savedNormalBounds = null;
let localServer = null;

function createLocalStaticServer(distDir) {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2'
  };

  const server = http.createServer((req, res) => {
    let reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/' || !reqPath) reqPath = '/index.html';

    let filePath = path.join(distDir, reqPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    });
  });

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function createWindow() {
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
    mainWindow.focus();
  });

  mainWindow.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  const distDir = path.join(__dirname, '../../../dist');

  try {
    if (process.env.VITE_DEV_SERVER_URL) {
      await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
      const local = await createLocalStaticServer(distDir);
      localServer = local.server;
      await mainWindow.loadURL(local.url);
    }
  } catch (err) {
    console.error('[Electron Main] Failed to load application:', err);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (localServer) {
      localServer.close();
      localServer = null;
    }
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
  if (localServer) {
    localServer.close();
    localServer = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
