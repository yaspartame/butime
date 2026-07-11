/* ===== BUTIME DATA LAYER ===== *
 * Handles all localStorage persistence,
 * multi-instance data, settings, and JSON export/import.
 * Load this BEFORE app.js in the HTML.
 * ================================= */

/* ---- ID generation ---- */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---- Instances ---- */
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

/* ---- Per-instance data ---- */
function getInstanceData(instanceId) {
  try { return JSON.parse(localStorage.getItem('butime_data_' + instanceId)) || { categories: [], events: [], todos: [] }; }
  catch { return { categories: [], events: [], todos: [] }; }
}
function saveInstanceData(instanceId, data) {
  localStorage.setItem('butime_data_' + instanceId, JSON.stringify(data));
}

function getActiveData() { return getInstanceData(getActiveInstanceId()); }
function saveActiveData(data) { saveInstanceData(getActiveInstanceId(), data); }

/* ---- Active instance shortcuts ---- */
function getCategories() { return getActiveData().categories; }
function getEvents() { return getActiveData().events; }
function getTodos() { return getActiveData().todos; }

function saveCategories(cats) { const d = getActiveData(); d.categories = cats; saveActiveData(d); }
function saveEvents(events) { const d = getActiveData(); d.events = events; saveActiveData(d); }
function saveTodos(todos) { const d = getActiveData(); d.todos = todos; saveActiveData(d); }

/* ---- Migration from old flat format ---- */
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
  try { return JSON.parse(localStorage.getItem('butime_settings')) || getDefaultSettings(); }
  catch { return getDefaultSettings(); }
}
function getDefaultSettings() { return { defaultNearImmediate: 24, defaultNearScheduled: 48, perTodoUrgency: false }; }
function saveSettings(s) { localStorage.setItem('butime_settings', JSON.stringify(s)); }

/* ---- Todo urgency status ---- */
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

/* ============================================ *
 *  JSON EXPORT / IMPORT                        *
 *  The full application state as a single JSON *
 * ============================================ */

/* ---- Export: builds a complete JSON blob ---- */
function exportAllData() {
  const instances = getInstances();
  const instancesData = {};
  instances.forEach(inst => {
    instancesData[inst.id] = getInstanceData(inst.id);
  });
  const payload = {
    butime: '1.0',
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    activeInstanceId: getActiveInstanceId(),
    instances: instances,
    instancesData: instancesData,
  };
  return JSON.stringify(payload, null, 2);
}

/* ---- Import: replaces ALL localStorage data from a JSON blob ---- */
function importAllData(jsonStr) {
  let payload;
  try { payload = JSON.parse(jsonStr); }
  catch (e) { throw new Error('Invalid JSON file'); }

  if (!payload.butime || !payload.instances || !payload.instancesData) {
    throw new Error('Invalid butime backup file');
  }

  // Wipe all existing butime keys
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('butime_') || key.startsWith('butime_data_'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  // Restore from payload
  saveSettings(payload.settings || getDefaultSettings());
  setActiveInstanceId(payload.activeInstanceId || 'default');
  saveInstances(payload.instances);

  Object.keys(payload.instancesData).forEach(id => {
    saveInstanceData(id, payload.instancesData[id]);
  });
}
