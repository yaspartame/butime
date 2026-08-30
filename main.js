const { app, BrowserWindow, shell, Menu, ipcMain, screen, Tray, nativeImage } = require('electron');
const path = require('path');

let overlayWin = null;
let widgetWin = null;
let mainWin = null;
let tray = null;
let isQuitting = false;
let closeAction = 'minimize'; //hi

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'butime',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'front', 'preload.js')
    }
  });
  mainWin = win;

  // Remove all menus so there's nothing to misconfigure
  Menu.setApplicationMenu(null);

  // Load your EXISTING app, completely unchanged
  win.loadFile(path.join(__dirname, 'front', 'index.html'));

  win.on('focus', () => {
    win.webContents.focus();
  });

  // Foolproofing: real links open in the browser, everything else is blocked
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) e.preventDefault();
  });

  win.on('close', (e) => {
    if (!isQuitting && closeAction === 'minimize') {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => {
    mainWin = null;
    if (overlayWin && !overlayWin.isDestroyed()) overlayWin.destroy();
    overlayWin = null;
    if (widgetWin && !widgetWin.isDestroyed()) widgetWin.destroy();
    widgetWin = null;
  });
}

function createOverlayWindow() {
  const display = screen.getPrimaryDisplay().workArea;
  const overlay = new BrowserWindow({
    width: 200,
    height: 124,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'front', 'preload.js')
    }
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.setPosition(display.x + display.width - 212, display.y + 12);
  overlay.loadFile(path.join(__dirname, 'front', 'overlay.html'));
  overlay.hide();
  return overlay;
}

function createWidgetWindow() {
  const widget = new BrowserWindow({
    width: 340,
    height: 420,
    minWidth: 240,
    minHeight: 240,
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: false,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'front', 'preload.js')
    }
  });
  // Right edge, below the pomodoro overlay, and clamped to the screen.
  const display = screen.getPrimaryDisplay().workArea;
  widget.setPosition(display.x + display.width - 352, display.y + 150);
  widget.on('move', () => {
    const b = widget.getBounds();
    const wa = screen.getDisplayNearestPoint({ x: b.x, y: b.y }).workArea;
    let x = b.x, y = b.y;
    if (y < wa.y) y = wa.y;
    if (x < wa.x) x = wa.x;
    if (x !== b.x || y !== b.y) widget.setPosition(x, y);
  });
  widget.loadFile(path.join(__dirname, 'front', 'widget.html'));
  widget.hide();
  return widget;
}

function createTray() {
  if (tray) tray.destroy();
  let icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'tray.png'));
  if (icon.isEmpty()) icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png'));
  if (icon.isEmpty()) icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('butime');
  const showMain = () => {
    if (!mainWin || mainWin.isDestroyed()) return;
    mainWin.show();
    mainWin.focus();
  };
  tray.on('click', () => {
    if (!mainWin || mainWin.isDestroyed()) return;
    if (mainWin.isVisible()) mainWin.hide();
    else showMain();
  });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'SHOW BUTIME', click: showMain },
    { type: 'separator' },
    { label: 'QUIT', click: () => { isQuitting = true; app.quit(); } },
  ]));
}

// Only allow a single instance — a second launch just focuses the running window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.show();
      mainWin.focus();
    }
  });
  app.whenReady().then(() => {
    createWindow();
    createTray();
    overlayWin = createOverlayWindow();
    widgetWin = createWidgetWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        overlayWin = createOverlayWindow();
        widgetWin = createWidgetWindow();
      }
    });
  });
}

ipcMain.on('pomo:update', (_e, state) => {
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.webContents.send('pomo:update', state);
});
ipcMain.on('pomo:overlay', (_e, show) => {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  if (show) overlayWin.showInactive();
  else overlayWin.hide();
});
// Forward the today/tomorrow data to the desktop widget.
ipcMain.on('widget:update', (_e, data) => {
  if (widgetWin && !widgetWin.isDestroyed()) widgetWin.webContents.send('widget:update', data);
});
// Show / hide the desktop widget.
ipcMain.on('widget:show', (_e, show) => {
  if (!widgetWin || widgetWin.isDestroyed()) return;
  if (show) widgetWin.showInactive();
  else widgetWin.hide();
});
ipcMain.on('app:closeAction', (_e, action) => {
  closeAction = (action === 'quit') ? 'quit' : 'minimize';
});
// Launch automatically when the user signs in to Windows
ipcMain.on('app:autostart', (_e, enable) => {
  app.setLoginItemSettings({ openAtLogin: !!enable });
});

app.on('before-quit', () => { isQuitting = true; });
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});