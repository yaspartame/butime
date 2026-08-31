// legacy data layer

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getInstances() {
  try { return JSON.parse(localStorage.getItem('butime_instances')) || []; }
  catch { return []; }
}
function saveInstances(list) {
  localStorage.setItem('butime_instances', JSON.stringify(list));
}

function getActiveInstanceId() {
  return localStorage.getItem('butime_activeInstance') || 'default';
}
function setActiveInstanceId(id) {
  localStorage.setItem('butime_activeInstance', id);
}

/* ---- Settings ---- */
function getSettings() {
  try { return Object.assign({}, getDefaultSettings(), JSON.parse(localStorage.getItem('butime_settings')) || {}); }
  catch { return getDefaultSettings(); }
}
function getDefaultSettings() { return { closeAction: 'minimize', autostart: true, widgetEnabled: true }; }
function saveSettings(s) { localStorage.setItem('butime_settings', JSON.stringify(s)); }

// BBU Data layer
// They do not share the same data as legacy
// And the legacy data does not disappear if bbu mode is chosen

function getBbuTasksForInstance(instanceId) {
  try { const d = JSON.parse(localStorage.getItem('butime_bbu_data_' + instanceId)) || {}; return d.bbuTasks || []; }
  catch { return []; }
}
function saveBbuTasksForInstance(instanceId, tasks) {
  let d = {};
  try { d = JSON.parse(localStorage.getItem('butime_bbu_data_' + instanceId)) || {}; } catch { d = {}; }
  d.bbuTasks = tasks;
  localStorage.setItem('butime_bbu_data_' + instanceId, JSON.stringify(d));
}
function getBbuTasks() { return getBbuTasksForInstance(getActiveInstanceId()); }
function saveBbuTasks(tasks) { saveBbuTasksForInstance(getActiveInstanceId(), tasks); }

function getBbuCategoriesForInstance(instanceId) {
  try { const d = JSON.parse(localStorage.getItem('butime_bbu_data_' + instanceId)) || {}; return d.bbuCategories || []; }
  catch { return []; }
}
function saveBbuCategoriesForInstance(instanceId, cats) {
  let d = {};
  try { d = JSON.parse(localStorage.getItem('butime_bbu_data_' + instanceId)) || {}; } catch { d = {}; }
  d.bbuCategories = cats;
  localStorage.setItem('butime_bbu_data_' + instanceId, JSON.stringify(d));
}
function getBbuCategories() { return getBbuCategoriesForInstance(getActiveInstanceId()); }
function saveBbuCategories(cats) { saveBbuCategoriesForInstance(getActiveInstanceId(), cats); }

/* ---- Migrate old global BBU storage into the active instance ---- */
function migrateBbuData() {
  try {
    getInstances().forEach(inst => {
      const tasks = getBbuTasksForInstance(inst.id);
      if (tasks.some(t => t.type === 'event' && t.completed)) {
        saveBbuTasksForInstance(inst.id, tasks.map(t => (t.type === 'event' ? { ...t, completed: false } : t)));
      }
    });
  } catch (_) {}
  const old = localStorage.getItem('butime_bbu_tasks');
  if (old === null) return;
  let tasks = [];
  try { tasks = JSON.parse(old) || []; } catch { tasks = []; }
  const activeId = getActiveInstanceId();
  if (getBbuTasksForInstance(activeId).length === 0) saveBbuTasksForInstance(activeId, tasks);
  localStorage.removeItem('butime_bbu_tasks');
}

function getBbuView() {
  return localStorage.getItem('butime_bbu_view') || 'matrix';
}
function setBbuView(view) {
  localStorage.setItem('butime_bbu_view', view);
}
function getBbuCalMode() {
  return localStorage.getItem('butime_bbu_cal_mode') || 'month';
}
function setBbuCalMode(mode) {
  localStorage.setItem('butime_bbu_cal_mode', mode);
}

function getPomoSettings() {
  const d = { workMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 4, sound: true, location: 'view', floatingOverlay: false, historyCollapsed: false };
  try { return Object.assign({}, d, JSON.parse(localStorage.getItem('butime_pomodoro')) || {}); }
  catch { return d; }
}
function savePomoSettings(s) {
  localStorage.setItem('butime_pomodoro', JSON.stringify(s));
}

function getPomoHistory() {
  try { return JSON.parse(localStorage.getItem('butime_pomo_history')) || []; }
  catch { return []; }
}
function savePomoHistory(h) {
  localStorage.setItem('butime_pomo_history', JSON.stringify(h));
}

// JSON Import Export

function exportAllData() {
  const instances = getInstances();
  const bbuInstancesData = {};
  const bbuInstancesCategories = {};
  instances.forEach(inst => {
    bbuInstancesData[inst.id] = getBbuTasksForInstance(inst.id);
    bbuInstancesCategories[inst.id] = getBbuCategoriesForInstance(inst.id);
  });
  const payload = {
    butime: '2.0.0',
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    activeInstanceId: getActiveInstanceId(),
    instances: instances,
    bbuInstancesData: bbuInstancesData,
    bbuInstancesCategories: bbuInstancesCategories,
    bbuView: getBbuView(),
    bbuCalMode: getBbuCalMode(),
    pomodoro: getPomoSettings(),
    bbuTasks: getBbuTasks(),
  };
  return JSON.stringify(payload, null, 2);
}

function importAllData(jsonStr) {
  let payload;
  try { payload = JSON.parse(jsonStr); }
  catch (e) { throw new Error('Invalid JSON file'); }

  if (!payload.butime || !payload.instances) {
    throw new Error('Invalid butime backup file');
  }

  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('butime_') || key.startsWith('butime_data_'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  saveSettings(payload.settings || getDefaultSettings());
  setActiveInstanceId(payload.activeInstanceId || 'default');
  saveInstances(payload.instances);

  // Restore BBU view state (if present in the backup)
  if (payload.bbuView) setBbuView(payload.bbuView);
  if (payload.bbuCalMode) setBbuCalMode(payload.bbuCalMode);
  if (payload.pomodoro) savePomoSettings(payload.pomodoro);
  if (payload.bbuInstancesData) {
    Object.keys(payload.bbuInstancesData).forEach(id => {
      saveBbuTasksForInstance(id, payload.bbuInstancesData[id] || []);
    });
  } else if (payload.bbuTasks) {
    saveBbuTasksForInstance(getActiveInstanceId(), payload.bbuTasks);
  }
  if (payload.bbuInstancesCategories) {
    Object.keys(payload.bbuInstancesCategories).forEach(id => {
      saveBbuCategoriesForInstance(id, payload.bbuInstancesCategories[id] || []);
    });
  }
}
