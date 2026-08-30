const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('butime', {

  sendPomoState: (state) => ipcRenderer.send('pomo:update', state),
  toggleOverlay: (show) => ipcRenderer.send('pomo:overlay', show),
  setCloseAction: (action) => ipcRenderer.send('app:closeAction', action),
  setAutoStart: (enable) => ipcRenderer.send('app:autostart', enable),
  sendWidgetData: (payload) => ipcRenderer.send('widget:update', payload),
  toggleWidget: (show) => ipcRenderer.send('widget:show', { id: 'w1', show }),
  widgetShow: (id) => ipcRenderer.send('widget:show', { id, show: true }),
  widgetAdd: (instanceId) => ipcRenderer.send('widget:add', instanceId),
  widgetClose: (id) => ipcRenderer.send('widget:close', id),
  widgetGetData: (id) => ipcRenderer.send('widget:getdata', id),
  widgetReady: () => ipcRenderer.send('widget:ready', true),

  onPomoState: (cb) => ipcRenderer.on('pomo:update', (_e, state) => cb(state)),
  onWidgetData: (cb) => ipcRenderer.on('widget:update', (_e, payload) => cb(payload)),
  onWidgetList: (cb) => ipcRenderer.on('widget:list', (_e, list) => cb(list)),
  onWidgetRefresh: (cb) => ipcRenderer.on('widget:refresh', (_e, id) => cb(id)),
  onWidgetClosed: (cb) => ipcRenderer.on('widget:closed', (_e, id) => cb(id)),
  onWidgetVisibility: (cb) => ipcRenderer.on('widget:visibility', (_e, visible) => cb(visible)),
});
