const { app, BrowserWindow, shell, Menu, ipcMain, screen, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let overlayWin = null;
let widgets = [];
let mainWin = null;
let tray = null;
let isQuitting = false;
let closeAction = 'minimize'; //hi

// Widget config persistence: which widgets exist, which instance each shows, and
// each widget's size/position — survives restarts, including a full close.
const widgetStateFile = () => path.join(app.getPath('userData'), 'widget-state.json'); // legacy (migration)
const widgetConfigFile = () => path.join(app.getPath('userData'), 'widgets-config.json');
let widgetCfg = { widgets: [{ id: 'w1', instanceId: null }], bounds: {} };
let widgetSaveTimer = null;
function loadWidgetConfig() {
  let cfg = null;
  try { cfg = JSON.parse(fs.readFileSync(widgetConfigFile(), 'utf8')); } catch (_) { cfg = null; }
  if (!cfg || !Array.isArray(cfg.widgets) || !cfg.widgets.length) {
    // Migrate the old single-widget size/position into the main widget.
    let old = null;
    try { old = JSON.parse(fs.readFileSync(widgetStateFile(), 'utf8')); } catch (_) { old = null; }
    cfg = { widgets: [{ id: 'w1', instanceId: null }], bounds: old ? { w1: old } : {} };
  }
  if (!cfg.bounds) cfg.bounds = {};
  return cfg;
}
function persistWidgetConfig() {
  try { fs.writeFileSync(widgetConfigFile(), JSON.stringify(widgetCfg)); } catch (_) {}
}
function saveWidgetBounds(id, b) {
  widgetCfg.bounds[id] = { x: b.x, y: b.y, width: b.width, height: b.height };
  clearTimeout(widgetSaveTimer);
  widgetSaveTimer = setTimeout(persistWidgetConfig, 400);
}

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
    widgets.forEach(w => { if (w.win && !w.win.isDestroyed()) w.win.destroy(); });
    widgets = [];
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

// Create a widget window bound to a butime instance (null = the active instance).
// The URL carries ?id=<widgetId>&instance=<instanceId> so the widget knows its role.
function createWidgetWindow(id, instanceId) {
  const win = new BrowserWindow({
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
  // Restore the last size/position (persisted per widget), clamped to the screen.
  const saved = widgetCfg.bounds && widgetCfg.bounds[id];
  const display = screen.getPrimaryDisplay().workArea;
  if (saved && saved.width && saved.height) {
    const wa = screen.getDisplayNearestPoint({ x: saved.x, y: saved.y }).workArea;
    let x = saved.x, y = saved.y;
    if (y < wa.y) y = wa.y;
    if (x < wa.x) x = wa.x;
    win.setBounds({ x, y, width: Math.max(240, saved.width), height: Math.max(240, saved.height) });
  } else {
    // Cascade new widgets away from the existing ones.
    const offset = widgets.length * 24;
    win.setPosition(display.x + display.width - 352 - offset, display.y + 150 + offset);
  }
  win.on('resize', () => { if (!win.isDestroyed()) saveWidgetBounds(id, win.getBounds()); });
  win.on('move', () => { if (!win.isDestroyed()) saveWidgetBounds(id, win.getBounds()); });
  win.loadFile(path.join(__dirname, 'front', 'widget.html'), { query: { id, instance: instanceId || '' } });
  win.hide();
  return { id, instanceId, win };
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
    widgetCfg = loadWidgetConfig();
    // Recreate every widget that was open when the app last closed.
    widgetCfg.widgets.forEach(w => {
      if (w && w.id) widgets.push(createWidgetWindow(w.id, w.instanceId || null));
    });
    if (!widgets.length) widgets.push(createWidgetWindow('w1', null));
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        overlayWin = createOverlayWindow();
        widgets.forEach(w => { if (w.win && !w.win.isDestroyed()) w.win.destroy(); });
        widgets = [];
        widgetCfg.widgets.forEach(w => { if (w && w.id) widgets.push(createWidgetWindow(w.id, w.instanceId || null)); });
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
// Forward today/tomorrow data to a specific widget window.
ipcMain.on('widget:update', (_e, payload) => {
  const w = widgets.find(x => x.id === (payload && payload.id));
  if (w && w.win && !w.win.isDestroyed()) w.win.webContents.send('widget:update', payload);
});
// Show / hide a widget window (the header toggle targets the main one).
ipcMain.on('widget:show', (_e, payload) => {
  const id = (payload && payload.id) || 'w1';
  const show = !!(payload && payload.show);
  const w = widgets.find(x => x.id === id);
  if (!w || !w.win || w.win.isDestroyed()) return;
  if (show) w.win.showInactive();
  else w.win.hide();
  // Keep the app's header toggle in sync with the main widget's visibility.
  if (id === 'w1' && mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('widget:visibility', show);
});
// Add a new widget bound to an instance.
ipcMain.on('widget:add', (_e, instanceId) => {
  if (!instanceId) return;
  if (widgets.some(w => w.id !== 'w1' && w.instanceId === instanceId)) return; // already added
  const id = 'w' + Date.now().toString(36);
  widgets.push(createWidgetWindow(id, instanceId));
  widgetCfg.widgets = widgets.map(w => ({ id: w.id, instanceId: w.instanceId }));
  persistWidgetConfig();
  const w = widgets.find(x => x.id === id);
  if (w && w.win && !w.win.isDestroyed()) w.win.showInactive();
  broadcastWidgetList();
});
// Close a widget: the main widget just hides, added ones close entirely.
ipcMain.on('widget:close', (_e, id) => {
  const idx = widgets.findIndex(w => w.id === id);
  if (idx === -1) return;
  if (id === 'w1') {
    // Main widget: hide it and persist the closed state.
    widgets[idx].win.hide();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('widget:visibility', false);
      mainWin.webContents.send('widget:closed', 'w1');
    }
    return;
  }
  const w = widgets[idx];
  if (w.win && !w.win.isDestroyed()) w.win.destroy();
  widgets.splice(idx, 1);
  widgetCfg.widgets = widgets.map(x => ({ id: x.id, instanceId: x.instanceId }));
  persistWidgetConfig();
  broadcastWidgetList();
});
// A widget window just loaded — ask the app for fresh data.
ipcMain.on('widget:getdata', (_e, id) => {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('widget:refresh', id);
});
// The app window is ready — tell it which widgets exist.
ipcMain.on('widget:ready', () => broadcastWidgetList());
function broadcastWidgetList() {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('widget:list', widgets.map(w => ({ id: w.id, instanceId: w.instanceId, isMain: w.id === 'w1' })));
  }
}
ipcMain.on('app:closeAction', (_e, action) => {
  closeAction = (action === 'quit') ? 'quit' : 'minimize';
});
// Launch automatically when the user signs in to Windows
ipcMain.on('app:autostart', (_e, enable) => {
  app.setLoginItemSettings({ openAtLogin: !!enable });
});

app.on('before-quit', () => {
  isQuitting = true;
  // Save the current widget set + their bounds so they restore next launch.
  widgetCfg.widgets = widgets.map(w => ({ id: w.id, instanceId: w.instanceId }));
  widgets.forEach(w => {
    if (w.win && !w.win.isDestroyed()) widgetCfg.bounds[w.id] = w.win.getBounds();
  });
  persistWidgetConfig();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});