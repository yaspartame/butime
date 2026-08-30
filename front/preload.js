const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('butime', {

  sendPomoState: (state) => ipcRenderer.send('pomo:update', state),
  toggleOverlay: (show) => ipcRenderer.send('pomo:overlay', show),
  setCloseAction: (action) => ipcRenderer.send('app:closeAction', action),
  setAutoStart: (enable) => ipcRenderer.send('app:autostart', enable),
  sendWidgetData: (data) => ipcRenderer.send('widget:update', data),
  toggleWidget: (show) => ipcRenderer.send('widget:show', show),

  onPomoState: (cb) => ipcRenderer.on('pomo:update', (_e, state) => cb(state)),
  onWidgetData: (cb) => ipcRenderer.on('widget:update', (_e, data) => cb(data)),
});
