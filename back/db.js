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

function getInstanceData(instanceId) {
  try { return JSON.parse(localStorage.getItem('butime_data_' + instanceId)) || { categories: [], events: [], todos: [] }; }
  catch { return { categories: [], events: [], todos: [] }; }
}
function saveInstanceData(instanceId, data) {
  localStorage.setItem('butime_data_' + instanceId, JSON.stringify(data));
}

function getActiveData() { return getInstanceData(getActiveInstanceId()); }
function saveActiveData(data) { saveInstanceData(getActiveInstanceId(), data); }

function getCategories() { return getActiveData().categories; }
function getEvents() { return getActiveData().events; }
function getTodos() { return getActiveData().todos; }

function saveCategories(cats) { const d = getActiveData(); d.categories = cats; saveActiveData(d); }
function saveEvents(events) { const d = getActiveData(); d.events = events; saveActiveData(d); }
function saveTodos(todos) { const d = getActiveData(); d.todos = todos; saveActiveData(d); }

function migrateOldData() {
  const instances = getInstances();
  if (instances.length > 0) return;
  const oldCats = (() => { try { return JSON.parse(localStorage.getItem('butime_categories')) || []; } catch { return []; } })();
  const oldEvents = (() => { try { return JSON.parse(localStorage.getItem('butime_events')) || []; } catch { return []; } })();
  const oldTodos = (() => { try { return JSON.parse(localStorage.getItem('butime_todos')) || []; } catch { return []; } })();
  localStorage.removeItem('butime_categories');
  localStorage.removeItem('butime_events');
  localStorage.removeItem('butime_todos');
  saveInstances([{ id: 'default', name: 'Default' }]);
  setActiveInstanceId('default');
  saveInstanceData('default', {
    categories: oldCats.length ? oldCats : [{ id: genId(), name: 'Task', color: '#6b7db3' }],
    events: oldEvents, todos: oldTodos,
  });
}

/* ---- Settings ---- */
function getSettings() {
  try { return Object.assign({}, getDefaultSettings(), JSON.parse(localStorage.getItem('butime_settings')) || {}); }
  catch { return getDefaultSettings(); }
}
function getDefaultSettings() { return { defaultNearImmediate: 24, defaultNearScheduled: 48, perTodoUrgency: false, closeAction: 'minimize', autostart: true, widgetEnabled: true }; }
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

function getMode() {
  return localStorage.getItem('butime_mode') || 'legacy';
}
function setMode(mode) {
  localStorage.setItem('butime_mode', mode);
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
  const d = { workMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 4, sound: true, location: 'view', floatingOverlay: false };
  try { return Object.assign({}, d, JSON.parse(localStorage.getItem('butime_pomodoro')) || {}); }
  catch { return d; }
}
function savePomoSettings(s) {
  localStorage.setItem('butime_pomodoro', JSON.stringify(s));
}

function getTodoStatus(todo) {
  if (!todo.deadline || todo.type === 'casual') return { color: '#5a6380', near: false };
  const settings = getSettings();
  const deadline = new Date(todo.deadline).getTime();
  const now = Date.now();
  const diff = deadline - now;
  if (todo.type === 'immediate') {
    const threshold = todo.nearThreshold ? todo.nearThreshold * 3600000 : settings.defaultNearImmediate * 3600000;
    if (diff < threshold) return { color: '#e0535a', near: true };
    return { color: '#d4a84b', near: false };
  }
  if (todo.type === 'scheduled') {
    const threshold = todo.nearThreshold ? todo.nearThreshold * 3600000 : settings.defaultNearScheduled * 3600000;
    if (diff < threshold) return { color: '#d4884b', near: true };
    return { color: '#d4a84b', near: false };
  }
  return { color: '#5a6380', near: false };
}
function hasNearDeadlineTodos() {
  return getTodos().some(t => !t.completed && t.deadline && getTodoStatus(t).near);
}

// JSON Import Export

function exportAllData() {
  const instances = getInstances();
  const instancesData = {};
  const bbuInstancesData = {};
  const bbuInstancesCategories = {};
  instances.forEach(inst => {
    instancesData[inst.id] = getInstanceData(inst.id);
    bbuInstancesData[inst.id] = getBbuTasksForInstance(inst.id);
    bbuInstancesCategories[inst.id] = getBbuCategoriesForInstance(inst.id);
  });
  const payload = {
    butime: '2.0.0',
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    activeInstanceId: getActiveInstanceId(),
    instances: instances,
    instancesData: instancesData,
    bbuInstancesData: bbuInstancesData,
    bbuInstancesCategories: bbuInstancesCategories,
    mode: getMode(),
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

  if (!payload.butime || !payload.instances || !payload.instancesData) {
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

  Object.keys(payload.instancesData).forEach(id => {
    saveInstanceData(id, payload.instancesData[id]);
  });

  // Restore BBU mode state (if present in the backup)
  if (payload.mode) setMode(payload.mode);
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
