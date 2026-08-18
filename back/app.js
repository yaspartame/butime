/* ===== CONSTANTS ===== */
const HOUR_HEIGHT = 48;
const START_HOUR = 0;
const END_HOUR = 23;
const TOTAL_HOURS = END_HOUR - START_HOUR + 1;

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABELS = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

let state = {
  weekOffset: 0,
  editingId: null,
  editingCategoryId: null,
  editingTodoId: null,
  editingInstanceId: null,
  selectedCategoryId: null,
  selectedTodoType: 'casual',
  linkedTodoId: null,
  currentView: 'timetable',
  prevView: 'timetable',
  mode: getMode(),
  bbuView: getBbuView(),
  bbuCalMode: getBbuCalMode(),
  bbuCalOffset: 0,
  bbuCalMonthOffset: 0,
  bbuModal: null,
  bbuMenuTaskId: null,
};

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0,0,0,0);
  return d;
}
function getWeekDays(monday) {
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(d.getDate() + i); days.push(d); }
  return days;
}
function formatDate(date) { const d = new Date(date); return `${d.getDate()}/${d.getMonth()+1}`; }
function formatDateNice(date) {
  const d = new Date(date);
  const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
  return `${DAY_SHORT[dayIdx]} ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}
function formatDateISO(date) { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function isToday(date) { const n = new Date(); return date.getFullYear()===n.getFullYear() && date.getMonth()===n.getMonth() && date.getDate()===n.getDate(); }
function isPast(date) { const n = new Date(); n.setHours(0,0,0,0); return date < n; }
function getCurrentMonday() { return getMonday(new Date()); }
function getDisplayMonday() { const m = getCurrentMonday(); m.setDate(m.getDate() + state.weekOffset * 7); return m; }
function getWeekNumber(date) {
  const d = new Date(date); d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - (d.getDay()+6)%7);
  const w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - w1)/86400000 - 3 + (w1.getDay()+6)%7)/7);
}
function parseTimeToMinutes(t) { const [h,m] = t.split(':').map(Number); return h*60 + (m||0); }

const viewSelector = document.getElementById('viewSelector');
const viewCurrent = document.getElementById('viewCurrent');
const viewDropdown = document.getElementById('viewDropdown');
const alertBadge = document.getElementById('alertBadge');
viewSelector.addEventListener('click', () => { viewSelector.classList.toggle('open'); });
document.addEventListener('click', (e) => { if (!viewSelector.contains(e.target)) viewSelector.classList.remove('open'); });

function buildViewDropdown() {
  const dd = viewDropdown;
  dd.innerHTML = '';
  const opts = [];
  if (state.mode === 'bbu') opts.push(['matrix', 'MATRIX'], ['calendar', 'CALENDAR'], ['list', 'TASK LIST']);
  else opts.push(['timetable', 'TIMETABLE'], ['todo', 'TO DO LIST']);
  if ((getPomoSettings().location || 'view') !== 'sidebar') opts.push(['pomodoro', 'POMODORO']);
  opts.forEach(([v, label]) => {
    const o = document.createElement('div');
    o.className = 'view-option';
    o.dataset.view = v;
    o.textContent = label;
    dd.appendChild(o);
  });
  viewCurrent.textContent = state.currentView === 'settings' ? 'SETTINGS'
    : state.currentView === 'pomodoro' ? 'POMODORO'
    : state.mode === 'bbu'
      ? (state.bbuView === 'list' ? 'TASK LIST' : state.bbuView === 'calendar' ? 'CALENDAR' : 'MATRIX')
      : (state.currentView === 'todo' ? 'TO DO LIST' : 'TIMETABLE');
}
viewDropdown.addEventListener('click', (e) => { const opt = e.target.closest('.view-option'); if (!opt) return; switchView(opt.dataset.view); });

viewDropdown.addEventListener('click', (e) => { const opt = e.target.closest('.view-option'); if (!opt) return; switchView(opt.dataset.view); });

function normalizeView() {
  const cv = state.currentView;
  if (cv === 'settings' || cv === 'pomodoro') return;
  if (state.mode === 'bbu' && (cv === 'timetable' || cv === 'todo')) state.currentView = state.bbuView;
  if (state.mode === 'legacy' && (cv === 'matrix' || cv === 'calendar' || cv === 'list')) state.currentView = 'timetable';
}

function switchView(view) {
  viewSelector.classList.remove('open');
  if (view === 'settings') {
    state.prevView = state.currentView;
    state.currentView = 'settings';
    applyModeUI();
    return;
  }
  if (view === 'pomodoro') {
    state.currentView = 'pomodoro';
    applyModeUI();
    return;
  }
  if (state.mode === 'bbu') {
    if (view !== 'matrix' && view !== 'calendar' && view !== 'list') return;
    state.bbuView = view;
    setBbuView(view);
    state.currentView = view;
  } else {
    if (view !== 'timetable' && view !== 'todo') return;
    state.currentView = view;
  }
  applyModeUI();
}

function applyModeUI() {
  normalizeView();
  const cv = state.currentView;
  const bbu = state.mode === 'bbu';
  const inSettings = cv === 'settings';
  document.getElementById('headerLeft').style.display = (bbu || inSettings || cv === 'pomodoro') ? 'none' : '';
  buildViewDropdown();
  const show = v => cv === v ? '' : 'none';
  document.getElementById('viewBbuMatrix').style.display = show('matrix');
  document.getElementById('viewBbuCalendar').style.display = show('calendar');
  document.getElementById('viewBbuList').style.display = show('list');
  document.getElementById('viewPomodoro').style.display = show('pomodoro');
  document.getElementById('viewTimetable').style.display = show('timetable');
  document.getElementById('viewTodo').style.display = show('todo');
  document.getElementById('viewSettings').style.display = show('settings');
  document.getElementById('settingsLegacySections').style.display = (bbu || !inSettings) ? 'none' : '';
  document.querySelectorAll('.mode-option').forEach(o => o.classList.toggle('active', o.dataset.mode === state.mode));
  updateAlertBadge();
  if (inSettings) return;
  if (cv === 'pomodoro') { renderPomodoro(); return; }
  if (cv === 'matrix' || cv === 'calendar' || cv === 'list') renderBbu();
  else if (cv === 'todo') renderTodoList();
  else render();
}
function updateAlertBadge() { alertBadge.style.display = hasNearDeadlineTodos() ? 'inline-flex' : 'none'; }

document.getElementById('addBtn').addEventListener('click', () => {
  if (state.mode === 'bbu') openBbuModal({ mode: 'create', quadrant: BBU_QUADRANTS[0] });
  else if (state.currentView === 'timetable') openAddModal();
  else openTodoAddModal();
});

function renderSidebar() {
  const list = document.getElementById('sidebarList'), instances = getInstances(), activeId = getActiveInstanceId();
  list.innerHTML = '';
  instances.forEach(inst => {
    const item = document.createElement('div');
    item.className = 'sidebar-item';
    if (inst.id === activeId) item.classList.add('active');
    item.innerHTML = `<span class="sidebar-item-name">${esc(inst.name)}</span><button class="sidebar-item-edit" data-id="${inst.id}">✎</button>`;
    item.addEventListener('click', (e) => { if (e.target.closest('.sidebar-item-edit')) return; if (inst.id !== activeId) { setActiveInstanceId(inst.id); renderSidebar(); rerenderCurrentView(); updateAlertBadge(); } });
    item.querySelector('.sidebar-item-edit').addEventListener('click', (e) => { e.stopPropagation(); openInstanceEditModal(inst.id); });
    list.appendChild(item);
  });
}
document.getElementById('sidebarAddBtn').addEventListener('click', () => { state.editingInstanceId = null; document.getElementById('instanceName').value = ''; document.getElementById('instanceDeleteBtn').style.display = 'none'; document.getElementById('instanceModalTitle').textContent = 'NEW INSTANCE'; openModalById('instanceModalOverlay'); });
document.getElementById('sidebarCollapse').addEventListener('click', () => { document.getElementById('sidebar').classList.toggle('collapsed'); });
function openSettings() {
  const s = getSettings();
  document.getElementById('setNearImmediate').value = s.defaultNearImmediate;
  document.getElementById('setNearScheduled').value = s.defaultNearScheduled;
  document.getElementById('setPerTodoUrgency').checked = s.perTodoUrgency;
  switchView('settings');
}
document.getElementById('sidebarSettingsBtn').addEventListener('click', openSettings);
function openInstanceEditModal(id) { const inst = getInstances().find(i => i.id === id); if (!inst) return; state.editingInstanceId = id; document.getElementById('instanceName').value = inst.name; document.getElementById('instanceDeleteBtn').style.display = 'block'; document.getElementById('instanceModalTitle').textContent = 'EDIT INSTANCE'; openModalById('instanceModalOverlay'); }
document.getElementById('instanceModalSave').addEventListener('click', () => { const name = document.getElementById('instanceName').value.trim(); if (!name) { shakeBtn(document.getElementById('instanceModalSave')); return; } let instances = getInstances(); if (state.editingInstanceId) { const idx = instances.findIndex(i => i.id === state.editingInstanceId); if (idx !== -1) instances[idx] = { ...instances[idx], name }; } else { const newId = genId(); instances.push({ id: newId, name }); saveInstanceData(newId, { categories: [{ id: genId(), name: 'Task', color: '#6b7db3' }], events: [], todos: [] }); } saveInstances(instances); closeModalById('instanceModalOverlay'); renderSidebar(); });
document.getElementById('instanceDeleteBtn').addEventListener('click', () => {
  if (!state.editingInstanceId || !confirm('Delete this instance and all its data?')) return;
  let instances = getInstances(); const activeId = getActiveInstanceId();
  instances = instances.filter(i => i.id !== state.editingInstanceId);
  localStorage.removeItem('butime_data_' + state.editingInstanceId);
  if (instances.length === 0) { const newId = genId(); instances.push({ id: newId, name: 'Default' }); saveInstanceData(newId, { categories: [{ id: genId(), name: 'Task', color: '#6b7db3' }], events: [], todos: [] }); }
  if (activeId === state.editingInstanceId) setActiveInstanceId(instances[0].id);
  saveInstances(instances); closeModalById('instanceModalOverlay'); renderSidebar(); rerenderCurrentView(); updateAlertBadge();
});
document.getElementById('instanceModalClose').addEventListener('click', () => closeModalById('instanceModalOverlay'));
document.getElementById('instanceModalCancel').addEventListener('click', () => closeModalById('instanceModalOverlay'));

function settingsReturnView() {
  const pv = state.prevView;
  if (pv === 'pomodoro') return 'pomodoro';
  if (state.mode === 'bbu' && (pv === 'matrix' || pv === 'calendar' || pv === 'list')) return pv;
  if (state.mode === 'legacy' && (pv === 'timetable' || pv === 'todo')) return pv;
  return state.mode === 'bbu' ? 'matrix' : 'timetable';
}
document.getElementById('settingsBackBtn').addEventListener('click', () => { switchView(settingsReturnView()); });
document.getElementById('settingsSaveBtn').addEventListener('click', () => {
  saveSettings({
    defaultNearImmediate: parseInt(document.getElementById('setNearImmediate').value,10) || 24,
    defaultNearScheduled: parseInt(document.getElementById('setNearScheduled').value,10) || 48,
    perTodoUrgency: document.getElementById('setPerTodoUrgency').checked,
  });
  switchView(settingsReturnView());
});

document.getElementById('settingsExportBtn').addEventListener('click', () => {
  const json = exportAllData();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `butime-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('settingsImportBtn').addEventListener('click', () => {
  document.getElementById('settingsImportFile').click();
});

document.getElementById('settingsImportFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      importAllData(ev.target.result);
      state.mode = getMode();
      state.bbuView = getBbuView();
      renderSidebar();
      applyModeUI();
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  };
  reader.readAsText(file);
  // Reset so the same file can be re-imported
  e.target.value = '';
});

let pendingMode = null;
document.getElementById('modeSelector').addEventListener('click', (e) => {
  const opt = e.target.closest('.mode-option');
  if (!opt || opt.dataset.mode === state.mode) return;
  pendingMode = opt.dataset.mode;
  const from = state.mode.toUpperCase();
  const to = pendingMode.toUpperCase();
  document.getElementById('modeModalText').textContent = `Switch to ${to} mode? ${from} and ${to} each keep their own separate data — your ${from} data is saved, nothing gets deleted.`;
  openModalById('modeModalOverlay');
});
document.getElementById('modeModalConfirm').addEventListener('click', () => {
  if (!pendingMode || pendingMode === state.mode) return;
  state.mode = pendingMode;
  setMode(state.mode);
  if (state.mode === 'bbu') {
    const v = getBbuView();
    state.bbuView = (v === 'list' || v === 'calendar') ? v : 'matrix';
    state.currentView = state.bbuView;
  } else {
    state.currentView = 'timetable';
  }
  closeModalById('modeModalOverlay');
  applyModeUI();
});
document.getElementById('modeModalCancel').addEventListener('click', () => closeModalById('modeModalOverlay'));
document.getElementById('modeModalClose').addEventListener('click', () => closeModalById('modeModalOverlay'));

function render() {
  const monday = getDisplayMonday(), weekDays = getWeekDays(monday), events = getEvents(), cats = getCategories();
  document.getElementById('weekLabel').textContent = `W${getWeekNumber(monday)} // ${MONTH_SHORT[monday.getMonth()]} ${monday.getDate()} - ${MONTH_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getDate()} ${monday.getFullYear()}`;
  const table = document.getElementById('timetable'); table.innerHTML = '';
  for (let i = 0; i < 7; i++) { const d = weekDays[i]; const hdr = document.createElement('div'); hdr.className = 'day-header'; if (isToday(d)) hdr.classList.add('today'); if (isPast(d) && !isToday(d)) hdr.classList.add('past'); hdr.innerHTML = `<span class="day-name">${DAY_LABELS[i]}</span><span class="day-date">${formatDateNice(d)}</span>`; table.appendChild(hdr); }
  const gl = document.querySelector('.gutter-labels'); if (gl) { gl.innerHTML = ''; for (let h = START_HOUR; h <= END_HOUR; h++) { const lb = document.createElement('div'); lb.className = 'gutter-label'; lb.style.top = `${(h-START_HOUR)*HOUR_HEIGHT}px`; lb.textContent = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h-12} PM`; gl.appendChild(lb); } }
  for (let i = 0; i < 7; i++) { const d = weekDays[i]; const col = document.createElement('div'); col.className = 'day-column'; col.dataset.dayIndex = i; if (isToday(d)) col.classList.add('today'); if (isPast(d) && !isToday(d)) col.classList.add('past'); for (let h = 0; h < TOTAL_HOURS; h++) { const r = document.createElement('div'); r.className = 'hour-row'; col.appendChild(r); } table.appendChild(col); }
  const ws = formatDateISO(monday), we = formatDateISO(weekDays[6]);
  events.filter(e => e.date >= ws && e.date <= we).forEach(ev => { renderEvent(ev, weekDays, table, cats); });
  if (state.weekOffset === 0) { const now = new Date(), ti = (now.getDay()+6)%7, cm = now.getHours()*60+now.getMinutes(), ss = START_HOUR*60; if (cm >= ss && cm <= END_HOUR*60) { const cols = table.querySelectorAll('.day-column'); if (cols[ti]) { const ind = document.createElement('div'); ind.className = 'now-indicator'; ind.style.top = `${(cm-ss)/60*HOUR_HEIGHT}px`; cols[ti].style.position = 'relative'; cols[ti].appendChild(ind); } } }
}
function renderEvent(event, weekDays, table, cats) {
  const cols = table.querySelectorAll('.day-column'), di = DAYS.indexOf(event.day); if (di === -1) return; const col = cols[di]; if (!col) return;
  const color = (cats.find(c => c.id === event.categoryId) || {}).color || '#5a6380';
  const sm = parseTimeToMinutes(event.startTime), em = parseTimeToMinutes(event.endTime), top = ((sm-START_HOUR*60)/60)*HOUR_HEIGHT, height = Math.max((em-sm)/60*HOUR_HEIGHT, 16);
  const block = document.createElement('div'); block.className = 'event-block'; block.style.cssText = `top:${top}px;height:${height}px;background:${color}33;border-left-color:${color};color:${color}`; block.dataset.eventId = event.id; block.innerHTML = `<div class="event-title">${esc(event.title||'Untitled')}</div><div class="event-time">${event.startTime} - ${event.endTime}</div>`; block.addEventListener('click', () => openEditModal(event.id)); col.appendChild(block);
}
function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function renderCategorySelector() {
  const container = document.getElementById('categorySelector'), cats = getCategories(); container.innerHTML = '';
  cats.forEach(cat => { const opt = document.createElement('div'); opt.className = 'cat-option'; if (cat.id === state.selectedCategoryId) opt.classList.add('selected'); opt.innerHTML = `<span class="cat-dot" style="background:${cat.color}"></span><span class="cat-name">${esc(cat.name)}</span>`; opt.addEventListener('dblclick', (e) => { e.stopPropagation(); openCatEditModal(cat.id); }); opt.addEventListener('click', () => { state.selectedCategoryId = cat.id; document.querySelectorAll('.cat-option').forEach(el => el.classList.remove('selected')); opt.classList.add('selected'); if (getCategories().find(c => c.id === cat.id)) openLinkModal(cat.id); }); container.appendChild(opt); });
  if (!state.selectedCategoryId && cats.length > 0) { state.selectedCategoryId = cats[0].id; renderCategorySelector(); }
}

function openLinkModal(categoryId) {
  const todos = getTodos().filter(t => !t.completed), list = document.getElementById('todoPickerList'); list.innerHTML = '';
  const uo = document.createElement('div'); uo.className = 'todo-picker-item'; uo.innerHTML = '<span class="todo-picker-name" style="color:var(--text-muted)">— None (no linked todo) —</span>'; uo.addEventListener('click', () => { state.linkedTodoId = null; updateLinkedTodoBar(); closeModalById('linkModalOverlay'); }); list.appendChild(uo);
  todos.forEach(t => { const item = document.createElement('div'); item.className = 'todo-picker-item'; if (t.id === state.linkedTodoId) item.classList.add('selected'); const st = getTodoStatus(t); item.innerHTML = `<span class="todo-picker-name">${esc(t.name)}</span><span class="todo-picker-date" style="color:${st.color}">${t.deadline ? new Date(t.deadline).toLocaleString() : 'no deadline'}</span>`; item.addEventListener('click', () => { state.linkedTodoId = t.id; updateLinkedTodoBar(); closeModalById('linkModalOverlay'); }); list.appendChild(item); });
  document.getElementById('linkModalUnlink').style.display = state.linkedTodoId ? 'block' : 'none'; openModalById('linkModalOverlay');
}
document.getElementById('linkModalUnlink').addEventListener('click', () => { state.linkedTodoId = null; updateLinkedTodoBar(); closeModalById('linkModalOverlay'); });
document.getElementById('linkModalCancel').addEventListener('click', () => closeModalById('linkModalOverlay'));
document.getElementById('linkModalClose').addEventListener('click', () => closeModalById('linkModalOverlay'));
function updateLinkedTodoBar() { const g = document.getElementById('linkedTodoGroup'), n = document.getElementById('linkedTodoName'); if (state.linkedTodoId) { const t = getTodos().find(x => x.id === state.linkedTodoId); if (t) { n.textContent = `→ ${t.name}`; g.style.display = ''; return; } } g.style.display = 'none'; state.linkedTodoId = null; }
document.getElementById('linkedTodoBar').addEventListener('click', () => { if (state.selectedCategoryId) openLinkModal(state.selectedCategoryId); });
document.getElementById('linkedTodoRemove').addEventListener('click', (e) => { e.stopPropagation(); state.linkedTodoId = null; updateLinkedTodoBar(); });

document.getElementById('addCategoryBtn').addEventListener('click', () => { state.editingCategoryId = null; document.getElementById('catName').value = ''; document.getElementById('catColor').value = '#6b7db3'; document.getElementById('catColorHex').textContent = '#6b7db3'; document.getElementById('catDeleteBtn').style.display = 'none'; document.querySelector('#catModal .modal-title').textContent = 'NEW CATEGORY'; openModalById('catModalOverlay'); });
document.getElementById('catColor').addEventListener('input', function() { document.getElementById('catColorHex').textContent = this.value; });
document.getElementById('catModalSave').addEventListener('click', () => { const name = document.getElementById('catName').value.trim(), color = document.getElementById('catColor').value; if (!name) { shakeBtn(document.getElementById('catModalSave')); return; } let cats = getCategories(); if (state.editingCategoryId) { const idx = cats.findIndex(c => c.id === state.editingCategoryId); if (idx !== -1) cats[idx] = { ...cats[idx], name, color }; } else cats.push({ id: genId(), name, color }); saveCategories(cats); closeModalById('catModalOverlay'); renderCategorySelector(); });
document.getElementById('catDeleteBtn').addEventListener('click', () => { if (!state.editingCategoryId || !confirm('Delete this category?')) return; saveCategories(getCategories().filter(c => c.id !== state.editingCategoryId)); closeModalById('catModalOverlay'); if (state.selectedCategoryId === state.editingCategoryId) state.selectedCategoryId = null; renderCategorySelector(); });
function openCatEditModal(id) { const cat = getCategories().find(c => c.id === id); if (!cat) return; state.editingCategoryId = id; document.getElementById('catName').value = cat.name; document.getElementById('catColor').value = cat.color; document.getElementById('catColorHex').textContent = cat.color; document.getElementById('catDeleteBtn').style.display = 'block'; document.querySelector('#catModal .modal-title').textContent = 'EDIT CATEGORY'; openModalById('catModalOverlay'); }
document.getElementById('catModalClose').addEventListener('click', () => closeModalById('catModalOverlay'));
document.getElementById('catModalCancel').addEventListener('click', () => closeModalById('catModalOverlay'));

function populateDaySelect() { const sel = document.getElementById('entryDay'), monday = getDisplayMonday(); sel.innerHTML = ''; getWeekDays(monday).forEach((d,i) => { const opt = document.createElement('option'); opt.value = DAYS[i]; opt.textContent = formatDateNice(d); sel.appendChild(opt); }); }
function openAddModal() { state.editingId = null; state.linkedTodoId = null; updateLinkedTodoBar(); populateDaySelect(); document.getElementById('entryTitle').value = ''; document.getElementById('entryStart').value = ''; document.getElementById('entryEnd').value = ''; state.selectedCategoryId = null; renderCategorySelector(); document.getElementById('deleteBtn').style.display = 'none'; document.getElementById('modalTitle').textContent = 'NEW ENTRY'; openModalById('modalOverlay'); requestAnimationFrame(() => document.getElementById('entryTitle').focus()); }
function openEditModal(id) { const ev = getEvents().find(e => e.id === id); if (!ev) return; state.editingId = id; state.linkedTodoId = ev.linkedTodoId||null; updateLinkedTodoBar(); populateDaySelect(); document.getElementById('entryTitle').value = ev.title||''; document.getElementById('entryDay').value = ev.day; document.getElementById('entryStart').value = ev.startTime; document.getElementById('entryEnd').value = ev.endTime; state.selectedCategoryId = ev.categoryId; renderCategorySelector(); document.getElementById('deleteBtn').style.display = 'block'; document.getElementById('modalTitle').textContent = 'EDIT ENTRY'; openModalById('modalOverlay'); }
document.getElementById('modalSave').addEventListener('click', () => {
  const title = document.getElementById('entryTitle').value.trim(), day = document.getElementById('entryDay').value; let startTime = document.getElementById('entryStart').value, endTime = document.getElementById('entryEnd').value;
  if (!day) { shakeBtn(document.getElementById('modalSave')); return; } if (!startTime) { const n = new Date(); startTime = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`; } if (!endTime) { const [h,m] = startTime.split(':').map(Number); endTime = `${String(h+1).padStart(2,'0')}:${String(m).padStart(2,'0')}`; } if (parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)) { const [h,m] = startTime.split(':').map(Number); endTime = `${String(h+1).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  const eventDate = formatDateISO(getWeekDays(getDisplayMonday())[DAYS.indexOf(day)]); let events = getEvents();
  if (state.editingId) { const idx = events.findIndex(e => e.id === state.editingId); if (idx !== -1) events[idx] = { ...events[idx], title: title||'Untitled', day, startTime, endTime, categoryId: state.selectedCategoryId, date: eventDate, linkedTodoId: state.linkedTodoId }; }
  else events.push({ id: genId(), title: title||'Untitled', day, startTime, endTime, categoryId: state.selectedCategoryId, date: eventDate, linkedTodoId: state.linkedTodoId, createdAt: new Date().toISOString() });
  saveEvents(events); closeModalById('modalOverlay'); render();
});
document.getElementById('deleteBtn').addEventListener('click', () => { if (!state.editingId || !confirm('Delete this entry?')) return; saveEvents(getEvents().filter(e => e.id !== state.editingId)); closeModalById('modalOverlay'); render(); });
document.getElementById('entryStart').addEventListener('change', () => { if (document.getElementById('entryStart').value && !document.getElementById('entryEnd').value) { const [h,m] = document.getElementById('entryStart').value.split(':').map(Number); document.getElementById('entryEnd').value = `${String(h+1).padStart(2,'0')}:${String(m).padStart(2,'0')}`; } });
document.getElementById('modalClose').addEventListener('click', () => closeModalById('modalOverlay'));
document.getElementById('modalCancel').addEventListener('click', () => closeModalById('modalOverlay'));

function renderTodoList() {
  const container = document.getElementById('todoContainer'), todos = getTodos(), monday = getDisplayMonday(), weekDays = getWeekDays(monday);
  document.getElementById('weekLabel').textContent = `W${getWeekNumber(monday)} // ${MONTH_SHORT[monday.getMonth()]} ${monday.getDate()} - ${MONTH_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getDate()} ${monday.getFullYear()}`;
  container.innerHTML = '';
  const nearTodos = todos.filter(t => !t.completed && t.deadline && getTodoStatus(t).near);
  if (nearTodos.length > 0) { const b = document.createElement('div'); b.className = 'todo-warning-banner'; b.innerHTML = `⚠ ${nearTodos.length} todo${nearTodos.length>1?'s are':' is'} near deadline`; container.appendChild(b); }
  for (let i = 0; i < 7; i++) {
    const day = weekDays[i]; const dayTodos = todos.filter(t => t.deadline && formatDateISO(new Date(t.deadline)) === formatDateISO(day));
    const g = document.createElement('div'); g.className = 'todo-day-group';
    const h = document.createElement('div'); h.className = 'todo-day-header'; if (isToday(day)) h.classList.add('today'); if (isPast(day) && !isToday(day)) h.classList.add('past');
    h.innerHTML = `${DAY_LABELS[i]} ${formatDateNice(day)}${dayTodos.length ? ` (${dayTodos.length})` : ''}`; g.appendChild(h);
    dayTodos.sort((a,b) => { const sa = getTodoStatus(a), sb = getTodoStatus(b); if (sa.near && !sb.near) return -1; if (!sa.near && sb.near) return 1; return (a.deadline||'').localeCompare(b.deadline||''); });
    dayTodos.forEach(t => g.appendChild(createTodoElement(t)));
    if (i === 0) { const nd = todos.filter(t => !t.deadline); if (nd.length > 0) { const nh = document.createElement('div'); nh.className = 'todo-day-header'; nh.style.opacity = '0.5'; nh.textContent = 'NO DEADLINE'; g.appendChild(nh); nd.forEach(t => g.appendChild(createTodoElement(t))); } }
    container.appendChild(g);
  }
}
function createTodoElement(todo) { const el = document.createElement('div'); el.className = 'todo-item'; if (todo.completed) el.classList.add('completed'); const st = getTodoStatus(todo); if (st.near && !todo.completed) el.classList.add('urgent-warning'); el.innerHTML = `<div class="todo-check ${todo.completed?'checked':''}" data-todoid="${todo.id}"></div><div class="todo-info"><span class="todo-name">${esc(todo.name)}</span>${todo.deadline ? `<span class="todo-deadline">${new Date(todo.deadline).toLocaleString()}</span>` : '<span class="todo-deadline">no deadline</span>'}</div><div class="todo-dot" style="background:${st.color}"></div>`; el.querySelector('.todo-check').addEventListener('click', (e) => { e.stopPropagation(); toggleTodoComplete(todo.id); }); el.addEventListener('click', () => openTodoEditModal(todo.id)); return el; }
function toggleTodoComplete(id) { let t = getTodos(); const i = t.findIndex(x => x.id === id); if (i !== -1) { t[i].completed = !t[i].completed; saveTodos(t); renderTodoList(); updateAlertBadge(); } }

function openTodoAddModal() { state.editingTodoId = null; document.getElementById('todoName').value = ''; document.getElementById('todoDeadline').value = ''; setSelectedTodoType('casual'); document.getElementById('todoDeleteBtn').style.display = 'none'; document.getElementById('todoModalTitle').textContent = 'NEW TODO'; updateTodoNearField(); openModalById('todoModalOverlay'); requestAnimationFrame(() => document.getElementById('todoName').focus()); }
function openTodoEditModal(id) { const t = getTodos().find(x => x.id === id); if (!t) return; state.editingTodoId = id; document.getElementById('todoName').value = t.name; document.getElementById('todoDeadline').value = t.deadline ? t.deadline.slice(0,16) : ''; setSelectedTodoType(t.type); document.getElementById('todoNearThreshold').value = t.nearThreshold||''; document.getElementById('todoDeleteBtn').style.display = 'block'; document.getElementById('todoModalTitle').textContent = 'EDIT TODO'; updateTodoNearField(); openModalById('todoModalOverlay'); }
function setSelectedTodoType(type) { state.selectedTodoType = type; document.querySelectorAll('.todo-type-option').forEach(o => o.classList.toggle('selected', o.dataset.value === type)); updateTodoNearField(); }
function updateTodoNearField() { const s = getSettings(); document.getElementById('todoNearGroup').style.display = (s.perTodoUrgency && (state.selectedTodoType === 'immediate' || state.selectedTodoType === 'scheduled')) ? '' : 'none'; }
document.querySelectorAll('.todo-type-option').forEach(opt => { opt.addEventListener('click', () => setSelectedTodoType(opt.dataset.value)); opt.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTodoType(opt.dataset.value); } }); });
document.getElementById('todoModalSave').addEventListener('click', () => { const name = document.getElementById('todoName').value.trim(), deadline = document.getElementById('todoDeadline').value||null, type = state.selectedTodoType; const s = getSettings(); let nearThreshold = null; if (s.perTodoUrgency && (type === 'immediate' || type === 'scheduled')) { const v = document.getElementById('todoNearThreshold').value; if (v) nearThreshold = parseInt(v,10); } if (!name) { shakeBtn(document.getElementById('todoModalSave')); return; } let todos = getTodos(); if (state.editingTodoId) { const idx = todos.findIndex(x => x.id === state.editingTodoId); if (idx !== -1) todos[idx] = { ...todos[idx], name, deadline: deadline ? deadline+':00' : null, type, nearThreshold }; } else todos.push({ id: genId(), name, deadline: deadline ? deadline+':00' : null, type, nearThreshold, completed: false, createdAt: new Date().toISOString() }); saveTodos(todos); closeModalById('todoModalOverlay'); renderTodoList(); updateAlertBadge(); });
document.getElementById('todoDeleteBtn').addEventListener('click', () => { if (!state.editingTodoId || !confirm('Delete this todo?')) return; saveTodos(getTodos().filter(x => x.id !== state.editingTodoId)); closeModalById('todoModalOverlay'); renderTodoList(); updateAlertBadge(); });
document.getElementById('todoModalClose').addEventListener('click', () => closeModalById('todoModalOverlay'));
document.getElementById('todoModalCancel').addEventListener('click', () => closeModalById('todoModalOverlay'));

function openModalById(id) { document.getElementById(id).classList.add('active'); }
function closeModalById(id) { document.getElementById(id).classList.remove('active'); }
['modalOverlay','catModalOverlay','linkModalOverlay','todoModalOverlay','instanceModalOverlay','bbuModalOverlay','modeModalOverlay','pomoSettingsOverlay'].forEach(id => { document.getElementById(id).addEventListener('click', (e) => { if (e.target === document.getElementById(id)) closeModalById(id); }); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeBbuMenu(); closePomoSettings(); ['modalOverlay','catModalOverlay','linkModalOverlay','todoModalOverlay','instanceModalOverlay','bbuModalOverlay','modeModalOverlay','pomoSettingsOverlay'].forEach(id => { if (document.getElementById(id).classList.contains('active')) closeModalById(id); }); } });

function rerenderCurrentView() { applyModeUI(); }
document.getElementById('prevWeek').addEventListener('click', () => { state.weekOffset--; rerenderCurrentView(); });
document.getElementById('nextWeek').addEventListener('click', () => { state.weekOffset++; rerenderCurrentView(); });
document.getElementById('todayBtn').addEventListener('click', () => { state.weekOffset = 0; rerenderCurrentView(); });

document.getElementById('timetableScroll').addEventListener('scroll', function() { const l = document.querySelector('.gutter-labels'); if (l) l.style.transform = `translateY(-${this.scrollTop}px)`; });

const styleSheet = document.createElement('style');
styleSheet.textContent = '@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}';
document.head.appendChild(styleSheet);
function shakeBtn(btn) { btn.style.animation = 'shake 0.3s'; setTimeout(() => { btn.style.animation = ''; }, 300); }

// bbu mode

const BBU_QUADRANTS = [
  { id: 'q1', title: 'URGENT & IMPORTANT',   urgent: true,  important: true,  color: '#e0535a', hint: 'Do first' },
  { id: 'q2', title: 'NOT URGENT & IMPORTANT', urgent: false, important: true, color: '#f2994a', hint: 'Schedule' },
  { id: 'q3', title: 'URGENT & UNIMPORTANT', urgent: true,  important: false, color: '#56ccf2', hint: 'Delegate' },
  { id: 'q4', title: 'NOT URGENT & UNIMPORTANT', urgent: false, important: false, color: '#4ade80', hint: 'Eliminate' },
];
const BBU_PRIORITIES = [
  { id: 0, label: 'None',   color: '#5a6380' },
  { id: 1, label: 'High',   color: '#e0535a' },
  { id: 2, label: 'Medium', color: '#f2994a' },
  { id: 3, label: 'Low',    color: '#56ccf2' },
];

function svgFlag() { return '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M5 3v18M5 4c3-1.5 5 1.5 8 0 2-1 4 .5 6 0V13c-2 .5-4-1-6 0-3 1.5-5-1.5-8 0z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'; }
function svgSun() { return '<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'; }
function svgSunrise() { return '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M2 18h20M5 18a7 7 0 0 1 14 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 3v3M7 6l2 2M17 6l-2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'; }
function svgCal7() { return '<svg viewBox="0 0 24 24" width="16" height="16"><rect x="3" y="4" width="18" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><text x="12" y="19.5" text-anchor="middle" font-size="9.5" font-family="Arial, sans-serif" font-weight="bold" fill="currentColor">7+</text></svg>'; }
function svgCal() { return '<svg viewBox="0 0 24 24" width="16" height="16"><rect x="3" y="4" width="18" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 9h18M8 2v4M16 2v4M8 14h3M8 18h3M14 14h2M14 18h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'; }
function svgCalX() { return '<svg viewBox="0 0 24 24" width="16" height="16"><rect x="3" y="4" width="18" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10 14l4 4M14 14l-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'; }
function svgPlus() { return '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'; }

function bbuQuadrantOf(t) { return BBU_QUADRANTS.find(q => q.urgent === !!t.urgent && q.important === !!t.important) || BBU_QUADRANTS[3]; }
function bbuPriorityMeta(p) { return BBU_PRIORITIES.find(x => x.id === p) || BBU_PRIORITIES[0]; }
function bbuChildren(tasks, id) { return tasks.filter(t => t.parentId === id); }
function bbuDescendants(tasks, id) {
  const out = [];
  (function walk(pid) { bbuChildren(tasks, pid).forEach(c => { out.push(c); walk(c.id); }); })(id);
  return out;
}
function bbuDueLabel(t) {
  if (!t.dueDate) return '';
  const d = new Date(t.dueDate + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const sameYear = d.getFullYear() === today.getFullYear();
  const s = DAY_SHORT[(d.getDay() + 6) % 7] + ' ' + MONTH_SHORT[d.getMonth()] + ' ' + d.getDate();
  return sameYear ? s : s + ' ' + d.getFullYear();
}
function bbuIsOverdue(t) { if (!t.dueDate) return false; const d = new Date(t.dueDate + 'T00:00:00'); const n = new Date(); n.setHours(0, 0, 0, 0); return d < n; }
function bbuTimeLabel(t) {
  if (!t || !t.time) return '';
  const [h, m] = t.time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}
function bbuTimeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}
function bbuHourLabel(h) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12} ${ampm}`;
}
// Tasks only store a start time, so each occupies a default block so that
// overlapping times can be detected and nested like Google Calendar.
const BBU_EVENT_DURATION_MIN = 60;
function bbuLayoutWeekEvents(items) {
  // items: [{ task, start(min), end(min) }] -> same array with col/left/width added.
  if (!items.length) return items;
  // Sort by start, then longer first (so same-start events order predictably).
  const evs = items.map((it, i) => Object.assign({ i }, it)).sort((a, b) => a.start - b.start || b.end - a.end);
  // Cluster events into connected components of the overlap graph.
  const groups = [];
  let group = [];
  let maxEnd = -Infinity;
  evs.forEach(ev => {
    if (ev.start >= maxEnd) { group = []; groups.push(group); }
    group.push(ev);
    maxEnd = Math.max(maxEnd, ev.end);
  });
  // Within each cluster, assign columns greedily; overlapping events get
  // different columns, everyone shares the cluster width equally.
  groups.forEach(g => {
    const cols = [];
    g.forEach(ev => {
      let c = 0;
      while (c < cols.length && cols[c] > ev.start) c++;
      if (c >= cols.length) cols.push(ev.end);
      else cols[c] = Math.max(cols[c], ev.end);
      ev.col = c;
    });
    const n = cols.length;
    g.forEach(ev => { ev.left = (ev.col / n) * 100; ev.width = 100 / n; });
  });
  const byIdx = [];
  groups.forEach(g => g.forEach(ev => { byIdx[ev.i] = ev; }));
  return items.map((it, i) => byIdx[i]);
}
function bbuSortTasks(a, b) {
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
  const ad = a.dueDate || '', bd = b.dueDate || '';
  if (ad && bd) { const c = ad.localeCompare(bd); if (c) return c; }
  else if (ad) return -1;
  else if (bd) return 1;
  if ((a.priority || 0) !== (b.priority || 0)) return (b.priority || 0) - (a.priority || 0);
  return (a.createdAt || '').localeCompare(b.createdAt || '');
}
function bbuSyncChildren(tasks, parentId) {
  const p = tasks.find(t => t.id === parentId);
  if (!p) return;
  tasks.forEach(t => {
    if (t.parentId === parentId) {
      t.dueDate = p.dueDate;
      t.urgent = p.urgent;
      t.important = p.important;
      t.priority = p.priority;
      t.time = p.time;
      bbuSyncChildren(tasks, t.id);
    }
  });
}

function renderBbu() {
  if (state.bbuView === 'list') renderBbuList();
  else if (state.bbuView === 'calendar') renderBbuCalendar();
  else renderBbuMatrix();
}

function renderBbuCalendar() {
  document.querySelectorAll('.bbu-cal-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === state.bbuCalMode));
  if (state.bbuCalMode === 'month') renderBbuCalMonth();
  else renderBbuCalWeek();
}

function bbuCalStep(delta) {
  if (state.bbuCalMode === 'month') state.bbuCalMonthOffset += delta;
  else state.bbuCalOffset += delta;
  renderBbuCalendar();
}
function bbuCalToday() {
  state.bbuCalOffset = 0;
  state.bbuCalMonthOffset = 0;
  renderBbuCalendar();
}

function renderBbuCalWeek() {
  const base = getMonday(new Date());
  base.setDate(base.getDate() + state.bbuCalOffset * 7);
  const weekDays = getWeekDays(base);
  const wrap = document.getElementById('bbuCalendar');
  const tasks = getBbuTasks().filter(t => !t.parentId);
  document.getElementById('bbuCalLabel').textContent = `W${getWeekNumber(base)} // ${MONTH_SHORT[base.getMonth()]} ${base.getDate()} - ${MONTH_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getDate()} ${base.getFullYear()}`;
  wrap.className = 'bbu-calendar week';
  wrap.innerHTML = '';

  // Visible hour window — defaults to 6 AM – 11 PM like a Google Calendar
  // zoomed week, but auto-extends when a task's time falls outside it so
  // nothing gets hidden.
  let startHour = 6, endHour = 24;
  tasks.forEach(t => {
    if (!t.time) return;
    const h = parseInt(t.time, 10);
    if (isNaN(h)) return;
    if (h < startHour) startHour = Math.max(0, h);
    if (h + 1 > endHour) endHour = Math.min(24, h + 1);
  });
  const hours = [];
  for (let h = startHour; h < endHour; h++) hours.push(h);

  const HOUR_H = 48;
  const gridH = hours.length * HOUR_H;
  const now = new Date();
  const nowTop = ((now.getHours() - startHour) * 60 + now.getMinutes()) / 60 * HOUR_H;
  const todayInWeek = weekDays.some(isToday);

  // Local UTC-offset label shown in the time gutter, e.g. GMT+08.
  const off = -new Date().getTimezoneOffset();
  const tzLabel = 'GMT' + (off >= 0 ? '+' : '-') + String(Math.floor(Math.abs(off) / 60)).padStart(2, '0') + (Math.abs(off) % 60 ? ':' + String(Math.abs(off) % 60).padStart(2, '0') : '');

  // ---- Day headers (with a left gutter spacer) ----
  const head = document.createElement('div');
  head.className = 'bbu-cal-week-head';
  const spacer = document.createElement('div');
  spacer.className = 'bbu-cal-week-head-spacer';
  spacer.textContent = tzLabel;
  head.appendChild(spacer);
  weekDays.forEach(d => {
    const hdr = document.createElement('div');
    hdr.className = 'bbu-cal-day-header';
    if (isToday(d)) hdr.classList.add('today');
    hdr.innerHTML = `<span class="day-name">${DAY_LABELS[(d.getDay() + 6) % 7]}</span><span class="day-date">${formatDateNice(d)}</span>`;
    head.appendChild(hdr);
  });

  // ---- All-day row (tasks with no time, or a time outside the grid) ----
  const allday = document.createElement('div');
  allday.className = 'bbu-cal-week-allday';
  const alldaySpacer = document.createElement('div');
  alldaySpacer.className = 'bbu-cal-week-allday-spacer';
  allday.appendChild(alldaySpacer);
  let hasAllday = false;
  weekDays.forEach(d => {
    const iso = formatDateISO(d);
    const cell = document.createElement('div');
    cell.className = 'bbu-cal-week-allday-cell';
    const unscheduled = tasks.filter(t => {
      if (t.completed || t.wontDo || t.dueDate !== iso) return false;
      if (!t.time) return true;
      const m = bbuTimeToMin(t.time);
      return m < startHour * 60 || m >= endHour * 60;
    }).sort(bbuSortTasks);
    if (unscheduled.length) {
      hasAllday = true;
      unscheduled.forEach(t => cell.appendChild(createBbuTaskEl(t, { compact: true })));
    }
    allday.appendChild(cell);
  });

  // ---- Scrollable timed grid ----
  const scroll = document.createElement('div');
  scroll.className = 'bbu-cal-week-scroll';
  scroll.appendChild(head);
  if (hasAllday) scroll.appendChild(allday);
  const body = document.createElement('div');
  body.className = 'bbu-cal-week-body';
  body.style.height = gridH + 'px';

  const gutter = document.createElement('div');
  gutter.className = 'bbu-cal-week-gutter';
  gutter.style.height = gridH + 'px';
  hours.forEach((h, i) => {
    const lab = document.createElement('div');
    lab.className = 'bbu-cal-week-hour-label';
    lab.style.top = (i * HOUR_H + 2) + 'px';
    lab.textContent = bbuHourLabel(h);
    gutter.appendChild(lab);
  });
  if (todayInWeek && nowTop >= 0 && nowTop <= gridH) {
    const dot = document.createElement('div');
    dot.className = 'bbu-cal-week-now-dot';
    dot.style.top = nowTop + 'px';
    gutter.appendChild(dot);
  }
  body.appendChild(gutter);

  weekDays.forEach(d => {
    const iso = formatDateISO(d);
    const dayTasks = tasks.filter(t => !t.completed && !t.wontDo && t.dueDate === iso);
    const col = document.createElement('div');
    col.className = 'bbu-cal-week-day';
    col.style.height = gridH + 'px';
    if (isToday(d)) col.classList.add('today');
    if (isPast(d) && !isToday(d)) col.classList.add('past');

    // Hour grid lines
    hours.forEach((h, i) => {
      const line = document.createElement('div');
      line.className = 'bbu-cal-week-line' + (h === 12 ? ' noon' : '');
      line.style.top = (i * HOUR_H) + 'px';
      col.appendChild(line);
    });

    // Timed tasks pinned to their exact time slot, nested into columns when
    // they overlap (Google Calendar style).
    const timed = dayTasks.filter(t => t.time && bbuTimeToMin(t.time) >= startHour * 60 && bbuTimeToMin(t.time) < endHour * 60);
    bbuLayoutWeekEvents(timed.map(t => ({ task: t, start: bbuTimeToMin(t.time), end: bbuTimeToMin(t.time) + BBU_EVENT_DURATION_MIN }))).forEach(ev => {
      const top = ((ev.start - startHour * 60) / 60) * HOUR_H;
      const el = createBbuTaskEl(ev.task, { compact: true });
      el.classList.add('bbu-cal-event');
      el.style.top = Math.max(0, top) + 'px';
      el.style.left = `calc(${ev.left}% + 2px)`;
      el.style.width = `calc(${ev.width}% - 4px)`;
      el.style.height = Math.max(20, ((ev.end - ev.start) / 60) * HOUR_H - 2) + 'px';
      col.appendChild(el);
    });

    // Current-time indicator
    if (isToday(d) && nowTop >= 0 && nowTop <= gridH) {
      const nowLine = document.createElement('div');
      nowLine.className = 'bbu-cal-week-now';
      nowLine.style.top = nowTop + 'px';
      col.appendChild(nowLine);
    }

    body.appendChild(col);
  });

  scroll.appendChild(body);
  wrap.appendChild(scroll);

  // Keep the all-day row pinned right below the headers when scrolling.
  if (hasAllday) {
    allday.style.top = (head.offsetHeight || 0) + 'px';
  }
  renderBbuCalOverdue(tasks);
}

function renderBbuCalMonth() {
  const today = new Date();
  const ref = new Date(today.getFullYear(), today.getMonth() + state.bbuCalMonthOffset, 1);
  const year = ref.getFullYear(), month = ref.getMonth();
  const wrap = document.getElementById('bbuCalendar');
  const tasks = getBbuTasks().filter(t => !t.parentId);
  document.getElementById('bbuCalLabel').textContent = `${MONTH_SHORT[month]} ${year}`;
  wrap.className = 'bbu-calendar month';
  wrap.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const hdr = document.createElement('div');
    hdr.className = 'bbu-cal-day-header';
    hdr.textContent = DAY_LABELS[i];
    wrap.appendChild(hdr);
  }
  const first = new Date(year, month, 1);
  const monday = getMonday(first);
  for (let i = 0; i < 42; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const inMonth = d.getMonth() === month;
    const iso = formatDateISO(d);
    const dayTasks = tasks.filter(t => !t.completed && !t.wontDo && t.dueDate === iso).sort(bbuSortTasks);
    const col = document.createElement('div');
    col.className = 'bbu-cal-day' + (inMonth ? '' : ' outside');
    if (isToday(d)) col.classList.add('today');
    if (isPast(d) && !isToday(d)) col.classList.add('past');
    const num = document.createElement('div');
    num.className = 'bbu-cal-day-num';
    num.textContent = d.getDate();
    col.appendChild(num);
    if (dayTasks.length) {
      const tl = document.createElement('div');
      tl.className = 'bbu-cal-day-tasks';
      dayTasks.forEach(t => tl.appendChild(createBbuTaskEl(t, { compact: true })));
      col.appendChild(tl);
    }
    wrap.appendChild(col);
  }
  renderBbuCalOverdue(tasks);
}

function renderBbuCalOverdue(tasks) {
  const todayISO = formatDateISO(new Date());
  const overdue = tasks.filter(t => !t.completed && !t.wontDo && t.dueDate && t.dueDate < todayISO).sort(bbuSortTasks);
  const strip = document.getElementById('bbuCalOverdue');
  strip.innerHTML = '';
  if (!overdue.length) return;
  const box = document.createElement('div');
  box.className = 'bbu-cal-overdue-box';
  const t = document.createElement('div');
  t.className = 'bbu-cal-overdue-title';
  t.textContent = `⚠ OVERDUE (${overdue.length})`;
  box.appendChild(t);
  const list = document.createElement('div');
  list.className = 'bbu-cal-overdue-list';
  overdue.forEach(tk => list.appendChild(createBbuTaskEl(tk)));
  box.appendChild(list);
  strip.appendChild(box);
}

function renderBbuMatrix() {
  const wrap = document.getElementById('bbuMatrix');
  const tasks = getBbuTasks();
  const topLevel = tasks.filter(t => !t.parentId);
  wrap.innerHTML = '';
  BBU_QUADRANTS.forEach(q => {
    const qTasks = topLevel.filter(t => !t.completed && !t.wontDo && !!t.urgent === q.urgent && !!t.important === q.important).sort(bbuSortTasks);
    const quad = document.createElement('div');
    quad.className = 'bbu-quadrant';
    quad.style.setProperty('--q', q.color);
    quad.dataset.quadrant = q.id;
    const h = document.createElement('div');
    h.className = 'bbu-quadrant-header';
    h.innerHTML = `<span class="bbu-q-dot" style="background:${q.color}"></span><span class="bbu-q-title">${q.title}</span><span class="bbu-q-hint">${q.hint}</span><span class="bbu-q-count">${qTasks.length}</span><button class="bbu-q-add" title="Add task">+</button>`;
    h.querySelector('.bbu-q-add').addEventListener('click', (e) => { e.stopPropagation(); openBbuModal({ mode: 'create', quadrant: q }); });
    quad.appendChild(h);
    const body = document.createElement('div');
    body.className = 'bbu-quadrant-body';
    if (qTasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bbu-q-empty';
      empty.textContent = 'No Tasks';
      body.appendChild(empty);
    } else {
      qTasks.forEach(t => body.appendChild(createBbuTaskEl(t)));
    }
    quad.appendChild(body);
    const completed = topLevel.filter(t => t.completed && !!t.urgent === q.urgent && !!t.important === q.important);
    if (completed.length > 0) {
      const ft = document.createElement('button');
      ft.className = 'bbu-q-completed';
      ft.innerHTML = `<span>Completed (${completed.length})</span><span class="bbu-caret">▾</span>`;
      ft.addEventListener('click', () => {
        const existing = quad.querySelector('.bbu-q-completed-list');
        if (existing) { existing.remove(); ft.classList.remove('open'); return; }
        const pl = document.createElement('div');
        pl.className = 'bbu-q-completed-list';
        completed.sort(bbuSortTasks).forEach(t => pl.appendChild(createBbuTaskEl(t)));
        quad.appendChild(pl);
        ft.classList.add('open');
      });
      quad.appendChild(ft);
    }
    wrap.appendChild(quad);
  });
  renderBbuWontDo();
}

function renderBbuWontDo() {
  const wrap = document.getElementById('bbuWontDo');
  const tasks = getBbuTasks().filter(t => !t.parentId && t.wontDo);
  wrap.innerHTML = '';
  if (!tasks.length) return;
  const box = document.createElement('div');
  box.className = 'bbu-wontdo-box';
  const h = document.createElement('button');
  h.className = 'bbu-wontdo-header';
  h.innerHTML = `<span>WON'T DO (${tasks.length})</span><span class="bbu-caret">▾</span>`;
  const list = document.createElement('div');
  list.className = 'bbu-wontdo-list';
  list.style.display = 'none';
  tasks.sort(bbuSortTasks).forEach(t => list.appendChild(createBbuTaskEl(t)));
  h.addEventListener('click', () => {
    const open = list.style.display !== 'none';
    list.style.display = open ? 'none' : '';
    h.classList.toggle('open', !open);
  });
  box.appendChild(h);
  box.appendChild(list);
  wrap.appendChild(box);
}

function createBbuTaskEl(task, opts) {
  const row = document.createElement('div');
  row.className = 'bbu-task';
  if (task.completed) row.classList.add('completed');
  if (task.wontDo) row.classList.add('wontdo');
  if (task.pinned) row.classList.add('pinned');
  const compact = opts && opts.compact;
  const q = bbuQuadrantOf(task);
  row.style.setProperty('--tc', q.color);
  const desc = (!compact && task.description) ? `<span class="bbu-task-desc">${esc(task.description)}</span>` : '';
  const meta = [];
  if (task.priority) meta.push(`<span class="bbu-flag" style="color:${bbuPriorityMeta(task.priority).color}">${svgFlag()}</span>`);
  if (task.pinned) meta.push('<span class="bbu-pin">📌</span>');
  if (task.dueDate) {
    if (compact) {
      if (task.time) meta.push(`<span class="bbu-due-chip">${bbuTimeLabel(task)}</span>`);
    } else {
      meta.push(`<span class="bbu-due-chip ${bbuIsOverdue(task) ? 'overdue' : ''}">${bbuDueLabel(task)}${task.time ? ' · ' + bbuTimeLabel(task) : ''}</span>`);
    }
  }
  row.innerHTML = `<div class="bbu-check ${task.completed ? 'checked' : ''}"></div><div class="bbu-task-main"><span class="bbu-task-name">${esc(task.name)}</span>${desc}${meta.length ? `<span class="bbu-task-meta">${meta.join('')}</span>` : ''}</div>`;
  row.addEventListener('click', (e) => { if (e.target.closest('.bbu-check')) return; openBbuModal({ mode: 'edit', editId: task.id }); });
  row.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); openBbuContextMenu(e, task.id); });
  row.querySelector('.bbu-check').addEventListener('click', (e) => { e.stopPropagation(); bbuToggleComplete(task.id); });
  const kids = bbuChildren(getBbuTasks(), task.id).sort(bbuSortTasks);
  if (kids.length) {
    const sub = document.createElement('div');
    sub.className = 'bbu-subtasks';
    kids.forEach(k => sub.appendChild(createBbuTaskEl(k, opts)));
    row.appendChild(sub);
  }
  return row;
}

function renderBbuList() {
  const wrap = document.getElementById('bbuList');
  const tasks = getBbuTasks();
  const topLevel = tasks.filter(t => !t.parentId);
  wrap.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'bbu-list-title';
  title.textContent = 'ALL TASKS';
  wrap.appendChild(title);
  let shown = 0;
  BBU_QUADRANTS.forEach(q => {
    const qTasks = topLevel.filter(t => !t.completed && !t.wontDo && !!t.urgent === q.urgent && !!t.important === q.important).sort(bbuSortTasks);
    if (!qTasks.length) return;
    const g = document.createElement('div');
    g.className = 'bbu-list-group';
    g.style.setProperty('--q', q.color);
    const gh = document.createElement('div');
    gh.className = 'bbu-list-group-header';
    gh.innerHTML = `<span class="bbu-q-dot" style="background:${q.color}"></span><span class="bbu-q-title">${q.title}</span><span class="bbu-q-hint">${q.hint}</span><span class="bbu-q-count">${qTasks.length}</span>`;
    g.appendChild(gh);
    qTasks.forEach(t => g.appendChild(createBbuTaskEl(t)));
    wrap.appendChild(g);
    shown += qTasks.length;
  });
  const completed = topLevel.filter(t => t.completed);
  if (completed.length) {
    const g = document.createElement('div');
    g.className = 'bbu-list-group bbu-list-dim';
    const gh = document.createElement('div');
    gh.className = 'bbu-list-group-header';
    gh.innerHTML = `<span class="bbu-q-title">COMPLETED</span><span class="bbu-q-count">${completed.length}</span>`;
    g.appendChild(gh);
    completed.sort(bbuSortTasks).forEach(t => g.appendChild(createBbuTaskEl(t)));
    wrap.appendChild(g);
  }
  const wontdo = topLevel.filter(t => t.wontDo);
  if (wontdo.length) {
    const g = document.createElement('div');
    g.className = 'bbu-list-group bbu-list-dim';
    const gh = document.createElement('div');
    gh.className = 'bbu-list-group-header';
    gh.innerHTML = `<span class="bbu-q-title">WON'T DO</span><span class="bbu-q-count">${wontdo.length}</span>`;
    g.appendChild(gh);
    wontdo.sort(bbuSortTasks).forEach(t => g.appendChild(createBbuTaskEl(t)));
    wrap.appendChild(g);
  }
  if (shown === 0 && completed.length === 0 && wontdo.length === 0) {
    const e = document.createElement('div');
    e.className = 'bbu-list-empty';
    e.textContent = 'No tasks yet — tap + to add one.';
    wrap.appendChild(e);
  }
}

function openBbuModal(opts) {
  const tasks = getBbuTasks();
  let quadrant = opts.quadrant || BBU_QUADRANTS[0];
  let priority = 0;
  let dueDate = null;
  let time = null;
  let name = '';
  let description = '';
  if (opts.mode === 'edit' && opts.editId) {
    const t = tasks.find(x => x.id === opts.editId);
    if (!t) return;
    quadrant = bbuQuadrantOf(t);
    priority = t.priority || 0;
    dueDate = t.dueDate || null;
    time = t.time || null;
    name = t.name;
    description = t.description || '';
  } else if (opts.mode === 'subtask' && opts.parentId) {
    const p = tasks.find(x => x.id === opts.parentId);
    if (!p) return;
    quadrant = bbuQuadrantOf(p);
    priority = p.priority || 0;
    dueDate = p.dueDate || null;
    time = p.time || null;
  }
  state.bbuModal = { mode: opts.mode || 'create', parentId: opts.parentId || null, editId: opts.editId || null, quadrant, priority, dueDate, time, description };
  document.getElementById('bbuTaskInput').value = name;
  const descInput = document.getElementById('bbuDescInput');
  descInput.value = description || '';
  descInput.style.height = 'auto';
  renderBbuQuadrantRow();
  renderBbuDue();
  renderBbuTime();
  renderBbuFlag();
  closeBbuPanels();
  document.getElementById('bbuModalOverlay').classList.add('active');
  requestAnimationFrame(() => {
    document.getElementById('bbuTaskInput').focus();
    descInput.style.height = Math.min(descInput.scrollHeight, 110) + 'px';
  });
}
function closeBbuModal() {
  document.getElementById('bbuModalOverlay').classList.remove('active');
  state.bbuModal = null;
}
function closeBbuPanels() {
  document.getElementById('bbuDatePanel').style.display = 'none';
  document.getElementById('bbuPriorityPanel').style.display = 'none';
  document.getElementById('bbuTimePanel').style.display = 'none';
}
function renderBbuQuadrantRow() {
  const row = document.getElementById('bbuQuadrantRow');
  row.innerHTML = '';
  BBU_QUADRANTS.forEach(q => {
    const d = document.createElement('div');
    d.className = 'bbu-quadrant-dot' + (state.bbuModal.quadrant.id === q.id ? ' active' : '');
    d.style.background = q.color;
    d.title = q.title;
    d.addEventListener('click', () => { state.bbuModal.quadrant = q; renderBbuQuadrantRow(); });
    row.appendChild(d);
  });
}
function renderBbuDue() {
  const t = state.bbuModal.dueDate;
  const el = document.getElementById('bbuDueText');
  el.textContent = t ? bbuDueLabel({ dueDate: t }) : 'No date';
  el.style.color = t ? 'var(--text-primary)' : 'var(--text-muted)';
}
function renderBbuTime() {
  const el = document.getElementById('bbuTimeText');
  const t = state.bbuModal.time;
  el.textContent = t ? bbuTimeLabel({ time: t }) : 'Time';
  el.style.color = t ? 'var(--text-primary)' : 'var(--text-muted)';
}
function renderBbuFlag() {
  document.getElementById('bbuFlagBtn').style.color = bbuPriorityMeta(state.bbuModal.priority).color;
}
function bbuModalSave() {
  const name = document.getElementById('bbuTaskInput').value.trim();
  if (!name) { shakeBtn(document.getElementById('bbuModalSaveBtn')); return; }
  const description = document.getElementById('bbuDescInput').value.trim();
  const m = state.bbuModal;
  if (!m) return;
  const tasks = getBbuTasks();
  const now = new Date().toISOString();
  if (m.mode === 'edit' && m.editId) {
    const t = tasks.find(x => x.id === m.editId);
    if (t) {
      t.name = name;
      t.urgent = m.quadrant.urgent;
      t.important = m.quadrant.important;
      t.priority = m.priority;
      t.dueDate = m.dueDate;
      t.time = m.time;
      t.description = description || '';
      bbuSyncChildren(tasks, t.id);
    }
  } else if (m.mode === 'subtask' && m.parentId) {
    const p = tasks.find(x => x.id === m.parentId);
    if (p) tasks.push({ id: genId(), name, parentId: p.id, urgent: p.urgent, important: p.important, priority: p.priority, dueDate: p.dueDate, time: p.time, description: description || '', completed: false, pinned: false, wontDo: false, createdAt: now });
  } else {
    tasks.push({ id: genId(), name, parentId: null, urgent: m.quadrant.urgent, important: m.quadrant.important, priority: m.priority, dueDate: m.dueDate, time: m.time, description: description || '', completed: false, pinned: false, wontDo: false, createdAt: now });
  }
  saveBbuTasks(tasks);
  closeBbuModal();
  renderBbu();
}

function bbuSetDueDate(taskId, date) {
  const tasks = getBbuTasks();
  const t = tasks.find(x => x.id === taskId);
  if (!t) return;
  t.dueDate = date;
  bbuSyncChildren(tasks, taskId);
  saveBbuTasks(tasks);
  renderBbu();
}
function bbuSetPriority(taskId, p) {
  const tasks = getBbuTasks();
  const t = tasks.find(x => x.id === taskId);
  if (!t) return;
  t.priority = p;
  bbuSyncChildren(tasks, taskId);
  saveBbuTasks(tasks);
  renderBbu();
}
function bbuTogglePin(taskId) {
  const tasks = getBbuTasks();
  const t = tasks.find(x => x.id === taskId);
  if (!t) return;
  t.pinned = !t.pinned;
  saveBbuTasks(tasks);
  renderBbu();
}
function bbuToggleWontDo(taskId) {
  const tasks = getBbuTasks();
  const t = tasks.find(x => x.id === taskId);
  if (!t) return;
  t.wontDo = !t.wontDo;
  if (t.wontDo) t.completed = false;
  saveBbuTasks(tasks);
  renderBbu();
}
function bbuToggleComplete(taskId) {
  const tasks = getBbuTasks();
  const t = tasks.find(x => x.id === taskId);
  if (!t) return;
  const target = !t.completed;
  t.completed = target;
  if (target) t.wontDo = false;
  bbuDescendants(tasks, taskId).forEach(d => {
    d.completed = target;
    if (target) d.wontDo = false;
  });
  saveBbuTasks(tasks);
  renderBbu();
}
function bbuDuplicate(taskId) {
  const tasks = getBbuTasks();
  const src = tasks.find(x => x.id === taskId);
  if (!src) return;
  const copy = (s, parentId) => {
    const newId = genId();
    tasks.push({ ...s, id: newId, parentId, completed: false, pinned: false, wontDo: false, createdAt: new Date().toISOString() });
    bbuChildren(tasks, s.id).forEach(c => copy(c, newId));
  };
  copy(src, null);
  saveBbuTasks(tasks);
  renderBbu();
}
function bbuDeleteTask(taskId) {
  const tasks = getBbuTasks();
  const kids = bbuDescendants(tasks, taskId).length;
  if (!confirm('Delete this task' + (kids ? ' and its ' + kids + ' subtask' + (kids > 1 ? 's' : '') : '') + '?')) return;
  const ids = new Set([taskId, ...bbuDescendants(tasks, taskId).map(t => t.id)]);
  saveBbuTasks(tasks.filter(t => !ids.has(t.id)));
  renderBbu();
}

function openBbuContextMenu(e, taskId) {
  const t = getBbuTasks().find(x => x.id === taskId);
  if (!t) return;
  state.bbuMenuTaskId = taskId;
  const q = bbuQuadrantOf(t);
  const m = document.getElementById('bbuMenu');
  const dueLabel = t.dueDate ? bbuDueLabel(t) : 'No date';
  m.innerHTML = `
    <div class="bbu-menu-header"><span class="bbu-q-dot" style="background:${q.color}"></span><span class="bbu-menu-title">${esc(t.name)}</span></div>
    <div class="bbu-menu-section">
      <div class="bbu-menu-label"><span>Date</span><span class="bbu-menu-current">${dueLabel}</span></div>
      <div class="bbu-menu-date-row">
        <button class="bbu-dq" data-due="today" title="Today">${svgSun()}</button>
        <button class="bbu-dq" data-due="tomorrow" title="Tomorrow">${svgSunrise()}</button>
        <button class="bbu-dq" data-due="week" title="Next week">${svgCal7()}</button>
        <button class="bbu-dq" data-due="custom" title="Custom date">${svgCal()}</button>
        <button class="bbu-dq" data-due="clear" title="Clear date">${svgCalX()}</button>
      </div>
      <div class="bbu-menu-custom" style="display:none"><input type="date" id="bbuMenuDateInput" value="${t.dueDate || ''}"></div>
    </div>
    <div class="bbu-menu-section">
      <div class="bbu-menu-label"><span>Priority</span></div>
      <div class="bbu-menu-priority-row">
        ${BBU_PRIORITIES.map(p => `<button class="bbu-pq ${t.priority === p.id ? 'active' : ''}" data-prio="${p.id}" title="${p.label}" style="color:${p.color}">${svgFlag()}</button>`).join('')}
      </div>
    </div>
    <div class="bbu-menu-section">
      <div class="bbu-menu-item" data-act="subtask">${svgPlus()} Add Subtask</div>
      <div class="bbu-menu-item" data-act="pomodoro">⏱ Add to Pomodoro</div>
      <div class="bbu-menu-item" data-act="pin">${t.pinned ? '📌 Unpin' : '📌 Pin'}</div>
      <div class="bbu-menu-item" data-act="wontdo">${t.wontDo ? '↩ Un-mark Won\'t Do' : '⛔ Won\'t Do'}</div>
      <div class="bbu-menu-item" data-act="duplicate">⎘ Duplicate</div>
      <div class="bbu-menu-item danger" data-act="delete">🗑 Delete</div>
    </div>`;
  m.style.display = 'block';
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let x = e.clientX, y = e.clientY;
  if (x + mw > window.innerWidth - 8) x = window.innerWidth - mw - 8;
  if (y + mh > window.innerHeight - 8) y = window.innerHeight - mh - 8;
  m.style.left = Math.max(4, x) + 'px';
  m.style.top = Math.max(4, y) + 'px';
  m.querySelectorAll('.bbu-dq').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.due;
    if (v === 'custom') {
      const c = m.querySelector('.bbu-menu-custom');
      const open = c.style.display !== 'none';
      c.style.display = open ? 'none' : 'block';
      if (!open) m.querySelector('#bbuMenuDateInput').focus();
      return;
    }
    bbuQuickDue(state.bbuMenuTaskId, v);
    closeBbuMenu();
  }));
  const di = m.querySelector('#bbuMenuDateInput');
  if (di) di.addEventListener('change', () => { bbuSetDueDate(state.bbuMenuTaskId, di.value || null); closeBbuMenu(); });
  m.querySelectorAll('.bbu-pq').forEach(b => b.addEventListener('click', () => { bbuSetPriority(state.bbuMenuTaskId, parseInt(b.dataset.prio, 10)); closeBbuMenu(); }));
  m.querySelectorAll('.bbu-menu-item').forEach(it => it.addEventListener('click', () => {
    const act = it.dataset.act;
    if (act === 'subtask') openBbuModal({ mode: 'subtask', parentId: state.bbuMenuTaskId });
    else if (act === 'pomodoro') pomoAddTask(state.bbuMenuTaskId);
    else if (act === 'pin') bbuTogglePin(state.bbuMenuTaskId);
    else if (act === 'wontdo') bbuToggleWontDo(state.bbuMenuTaskId);
    else if (act === 'duplicate') bbuDuplicate(state.bbuMenuTaskId);
    else if (act === 'delete') bbuDeleteTask(state.bbuMenuTaskId);
    closeBbuMenu();
  }));
}
function bbuQuickDue(taskId, which) {
  const n = new Date(); n.setHours(0, 0, 0, 0);
  if (which === 'today') bbuSetDueDate(taskId, formatDateISO(n));
  else if (which === 'tomorrow') { n.setDate(n.getDate() + 1); bbuSetDueDate(taskId, formatDateISO(n)); }
  else if (which === 'week') { n.setDate(n.getDate() + 7); bbuSetDueDate(taskId, formatDateISO(n)); }
  else if (which === 'clear') bbuSetDueDate(taskId, null);
}
function closeBbuMenu() {
  const m = document.getElementById('bbuMenu');
  m.style.display = 'none';
  m.innerHTML = '';
  state.bbuMenuTaskId = null;
}
document.addEventListener('click', (e) => { if (!e.target.closest('#bbuMenu')) closeBbuMenu(); });
document.addEventListener('contextmenu', (e) => { if (!e.target.closest('#bbuMenu')) closeBbuMenu(); });

function initBbuPanels() {
  const datePanel = document.getElementById('bbuDatePanel');
  document.getElementById('bbuDueBtn').addEventListener('click', () => {
    const show = datePanel.style.display === 'none';
    closeBbuPanels();
    datePanel.style.display = show ? 'block' : 'none';
    if (show) document.getElementById('bbuDateCustom').value = state.bbuModal.dueDate || '';
  });
  document.getElementById('bbuDateToday').addEventListener('click', () => { const n = new Date(); n.setHours(0, 0, 0, 0); state.bbuModal.dueDate = formatDateISO(n); renderBbuDue(); closeBbuPanels(); });
  document.getElementById('bbuDateTomorrow').addEventListener('click', () => { const n = new Date(); n.setDate(n.getDate() + 1); state.bbuModal.dueDate = formatDateISO(n); renderBbuDue(); closeBbuPanels(); });
  document.getElementById('bbuDateWeek').addEventListener('click', () => { const n = new Date(); n.setDate(n.getDate() + 7); state.bbuModal.dueDate = formatDateISO(n); renderBbuDue(); closeBbuPanels(); });
  document.getElementById('bbuDateCustom').addEventListener('change', (e) => { state.bbuModal.dueDate = e.target.value || null; renderBbuDue(); });
  document.getElementById('bbuDateClear').addEventListener('click', () => { state.bbuModal.dueDate = null; renderBbuDue(); closeBbuPanels(); });

  const prioPanel = document.getElementById('bbuPriorityPanel');
  document.getElementById('bbuFlagBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const show = prioPanel.style.display === 'none';
    closeBbuPanels();
    if (show) {
      prioPanel.style.display = 'block';
      prioPanel.innerHTML = '';
      BBU_PRIORITIES.forEach(p => {
        const b = document.createElement('button');
        b.className = 'bbu-quick bbu-prio-opt' + (state.bbuModal.priority === p.id ? ' active' : '');
        b.style.color = p.color;
        b.innerHTML = svgFlag() + ' ' + p.label;
        b.addEventListener('click', () => { state.bbuModal.priority = p.id; renderBbuFlag(); closeBbuPanels(); });
        prioPanel.appendChild(b);
      });
    }
  });
  document.getElementById('bbuModalCancelBtn').addEventListener('click', closeBbuModal);
  document.getElementById('bbuModalSaveBtn').addEventListener('click', bbuModalSave);
  document.getElementById('bbuTaskInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); bbuModalSave(); } });
  document.getElementById('bbuModalOverlay').addEventListener('click', (e) => { if (e.target === document.getElementById('bbuModalOverlay')) closeBbuModal(); });

  const descInput = document.getElementById('bbuDescInput');
  descInput.addEventListener('input', () => {
    descInput.style.height = 'auto';
    descInput.style.height = Math.min(descInput.scrollHeight, 110) + 'px';
  });

  const timePanel = document.getElementById('bbuTimePanel');
  document.getElementById('bbuTimeBtn').addEventListener('click', () => {
    const show = timePanel.style.display === 'none';
    closeBbuPanels();
    timePanel.style.display = show ? 'block' : 'none';
    if (show) document.getElementById('bbuTimeInput').value = state.bbuModal.time || '';
  });
  document.getElementById('bbuTimeInput').addEventListener('change', (e) => { state.bbuModal.time = e.target.value || null; renderBbuTime(); closeBbuPanels(); });
  document.getElementById('bbuTimeClear').addEventListener('click', () => { state.bbuModal.time = null; renderBbuTime(); closeBbuPanels(); });

  document.getElementById('bbuCalPrev').addEventListener('click', () => bbuCalStep(-1));
  document.getElementById('bbuCalNext').addEventListener('click', () => bbuCalStep(1));
  document.getElementById('bbuCalToday').addEventListener('click', bbuCalToday);
  document.getElementById('bbuCalModeToggle').addEventListener('click', (e) => {
    const b = e.target.closest('.bbu-cal-mode-btn');
    if (!b || b.dataset.mode === state.bbuCalMode) return;
    state.bbuCalMode = b.dataset.mode;
    setBbuCalMode(state.bbuCalMode);
    bbuCalToday();
  });
}

// Pomodoro Timer

const pomoState = {
  mode: 'focus',
  running: false,
  endTime: null,
  secondsLeft: getPomoSettings().workMin * 60,
  sessionCount: 0,
  taskId: null,
  title: '',
  done: false,
  advanceTimer: null,
};
let pomoAudioCtx = null;

function pomoFormatTime(sec) {
  const mm = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60);
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
function pomoNextSeconds(mode) {
  const s = getPomoSettings();
  if (mode === 'focus') return Math.max(1, s.workMin) * 60;
  if (mode === 'shortBreak') return Math.max(0, s.shortBreakMin) * 60;
  return Math.max(0, s.longBreakMin) * 60;
}
function playChime() {
  if (!getPomoSettings().sound) return;
  try {
    if (!pomoAudioCtx) pomoAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = pomoAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    // High-pitched rising chime, ~2 seconds, loud
    const notes = [
      { f: 880, d: 0, dur: 0.3 },        // A5
      { f: 1108.73, d: 0.32, dur: 0.3 }, // C#6
      { f: 1318.51, d: 0.64, dur: 0.3 }, // E6
      { f: 1567.98, d: 0.96, dur: 0.3 }, // G6
      { f: 1760, d: 1.28, dur: 0.78 },   // A6 (held)
    ];
    notes.forEach(n => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = n.f;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + n.d;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.7, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
      o.start(t);
      o.stop(t + n.dur + 0.05);
    });
  } catch (e) { /* sound unavailable */ }
}
function pomoCompleteInterval() {
  const s = getPomoSettings();
  playChime();
  pomoState.running = false;
  pomoState.secondsLeft = 0;
  pomoState.done = true;
  let next;
  if (pomoState.mode === 'focus') {
    pomoState.sessionCount++;
    next = (pomoState.sessionCount % s.longBreakEvery === 0) ? 'longBreak' : 'shortBreak';
  } else {
    next = 'focus';
  }
  // Let the alarm finish before the next session starts
  const waitMs = s.sound ? 2300 : 60;
  clearTimeout(pomoState.advanceTimer);
  pomoState.advanceTimer = setTimeout(() => {
    pomoState.mode = next;
    pomoState.done = false;
    pomoState.secondsLeft = pomoNextSeconds(pomoState.mode);
    if (pomoState.secondsLeft <= 0) {
      pomoState.mode = 'focus';
      pomoState.secondsLeft = pomoNextSeconds('focus');
    }
    pomoState.running = true;
    pomoState.endTime = Date.now() + pomoState.secondsLeft * 1000;
    renderPomodoro();
  }, waitMs);
  renderPomodoro();
}
function pomoStart() {
  clearTimeout(pomoState.advanceTimer);
  if (pomoState.done) {
    // Skip the remaining alarm wait and start the next session now
    const s = getPomoSettings();
    if (pomoState.mode === 'focus') {
      pomoState.sessionCount++;
      pomoState.mode = (pomoState.sessionCount % s.longBreakEvery === 0) ? 'longBreak' : 'shortBreak';
    } else {
      pomoState.mode = 'focus';
    }
    pomoState.done = false;
  }
  if (pomoState.running) {
    pomoState.running = false;
  } else {
    if (pomoState.secondsLeft <= 0) pomoState.secondsLeft = pomoNextSeconds(pomoState.mode);
    pomoState.running = true;
    pomoState.endTime = Date.now() + pomoState.secondsLeft * 1000;
  }
  renderPomodoro();
}
function pomoReset() {
  clearTimeout(pomoState.advanceTimer);
  pomoState.running = false;
  pomoState.mode = 'focus';
  pomoState.secondsLeft = pomoNextSeconds('focus');
  pomoState.sessionCount = 0;
  pomoState.done = false;
  renderPomodoro();
}
function pomoFinishTask() {
  const taskId = pomoState.taskId;
  if (!taskId) return;
  const tasks = getBbuTasks();
  const t = tasks.find(x => x.id === taskId);
  if (t) {
    t.completed = true;
    t.wontDo = false;
    bbuDescendants(tasks, taskId).forEach(d => { d.completed = true; d.wontDo = false; });
    saveBbuTasks(tasks);
  }
  pomoState.taskId = null;
  pomoState.title = '';
  renderBbu();
  renderPomodoro();
}
function pomoUnlink() {
  pomoState.taskId = null;
  pomoState.title = '';
  renderPomodoro();
}
function pomoAddTask(taskId) {
  const t = getBbuTasks().find(x => x.id === taskId);
  if (!t) return;
  pomoState.taskId = taskId;
  pomoState.title = t.name;
  const loc = getPomoSettings().location || 'view';
  if (loc === 'sidebar') {
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('collapsed')) sidebar.classList.remove('collapsed');
    const w = document.getElementById('sidebarPomodoro');
    w.classList.remove('pomo-highlight');
    void w.offsetWidth;
    w.classList.add('pomo-highlight');
  } else {
    // Move straight to the pomodoro view
    state.currentView = 'pomodoro';
    applyModeUI();
  }
  renderPomodoro();
}
function renderPomodoro() {
  const timeStr = pomoFormatTime(pomoState.secondsLeft);
  const modeStr = pomoState.done
    ? (pomoState.mode === 'focus' ? 'FOCUS DONE' : pomoState.mode === 'shortBreak' ? 'BREAK DONE' : 'LONG BREAK DONE')
    : (pomoState.mode === 'focus' ? 'FOCUS' : pomoState.mode === 'shortBreak' ? 'SHORT BREAK' : 'LONG BREAK');
  document.querySelectorAll('.pomo-time').forEach(el => {
    el.textContent = timeStr;
    el.classList.toggle('pomo-break', pomoState.mode !== 'focus');
    el.classList.toggle('pomo-done', !!pomoState.done);
  });
  document.querySelectorAll('.pomo-mode').forEach(el => el.textContent = modeStr);
  document.querySelectorAll('.pomo-start').forEach(el => el.textContent = pomoState.running ? '⏸ PAUSE' : '▶ START');
  const s = getPomoSettings();
  document.querySelectorAll('.pomo-progress').forEach(prog => {
    prog.innerHTML = '';
    const done = pomoState.sessionCount % s.longBreakEvery;
    for (let i = 0; i < s.longBreakEvery; i++) {
      const d = document.createElement('span');
      d.className = 'pomo-dot' + (i < done ? ' done' : '');
      prog.appendChild(d);
    }
  });
  document.querySelectorAll('.pomo-title').forEach(titleEl => {
    if (pomoState.title) { titleEl.textContent = '⏱ ' + pomoState.title; titleEl.style.display = ''; }
    else titleEl.style.display = 'none';
  });
  document.querySelectorAll('.pomo-task-actions').forEach(el => el.style.display = pomoState.taskId ? '' : 'none');
}

function pomoSettingsHTML() {
  const p = getPomoSettings();
  const loc = p.location || 'view';
  return `
    <label class="pomo-set-row"><span>Focus</span><input type="number" class="pomo-set-focus" min="1" max="180" value="${p.workMin}"><span class="pomo-set-unit">min</span></label>
    <label class="pomo-set-row"><span>Short break</span><input type="number" class="pomo-set-short" min="0" max="60" value="${p.shortBreakMin}"><span class="pomo-set-unit">min</span></label>
    <label class="pomo-set-row"><span>Long break</span><input type="number" class="pomo-set-long" min="0" max="60" value="${p.longBreakMin}"><span class="pomo-set-unit">min</span></label>
    <label class="pomo-set-row"><span>Long break every</span><input type="number" class="pomo-set-every" min="1" max="12" value="${p.longBreakEvery}"><span class="pomo-set-unit">sessions</span></label>
    <label class="pomo-set-row pomo-set-toggle"><span>Sound</span><input type="checkbox" class="pomo-set-sound" ${p.sound ? 'checked' : ''}></label>
    <div class="pomo-set-row"><span>Pomodoro Location</span>
      <div class="pomo-loc-toggle">
        <button type="button" class="pomo-loc-btn ${loc === 'view' ? 'active' : ''}" data-loc="view">VIEW</button>
        <button type="button" class="pomo-loc-btn ${loc === 'sidebar' ? 'active' : ''}" data-loc="sidebar">SIDEBAR</button>
      </div>
    </div>
    <div class="pomo-set-actions">
      <button type="button" class="btn btn-cancel pomo-set-cancel">CANCEL</button>
      <button type="button" class="btn btn-save pomo-set-save">SAVE</button>
    </div>`;
}
function bindPomoSettings(container) {
  container.querySelector('.pomo-set-save').addEventListener('click', () => {
    const p = getPomoSettings();
    p.workMin = parseInt(container.querySelector('.pomo-set-focus').value, 10) || 25;
    p.shortBreakMin = parseInt(container.querySelector('.pomo-set-short').value, 10) || 5;
    p.longBreakMin = parseInt(container.querySelector('.pomo-set-long').value, 10) || 15;
    p.longBreakEvery = parseInt(container.querySelector('.pomo-set-every').value, 10) || 4;
    p.sound = container.querySelector('.pomo-set-sound').checked;
    const activeLoc = container.querySelector('.pomo-loc-btn.active');
    if (activeLoc) p.location = activeLoc.dataset.loc;
    savePomoSettings(p);
    closePomoSettings();
    pomoReset();
    applyPomoLocation();
  });
  container.querySelector('.pomo-set-cancel').addEventListener('click', closePomoSettings);
  container.querySelectorAll('.pomo-loc-btn').forEach(b => b.addEventListener('click', () => {
    container.querySelectorAll('.pomo-loc-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  }));
}
function openPomoSettings() {
  const loc = getPomoSettings().location || 'view';
  if (loc === 'sidebar') {
    const inline = document.getElementById('pomoSettingsInline');
    inline.style.display = inline.style.display === 'none' ? 'block' : 'none';
    if (inline.style.display === 'block') {
      inline.innerHTML = pomoSettingsHTML();
      bindPomoSettings(inline);
    }
  } else {
    const body = document.getElementById('pomoSettingsModalBody');
    body.innerHTML = pomoSettingsHTML();
    bindPomoSettings(body);
    openModalById('pomoSettingsOverlay');
  }
}
function closePomoSettings() {
  document.getElementById('pomoSettingsInline').style.display = 'none';
  document.getElementById('pomoSettingsOverlay').classList.remove('active');
}
function applyPomoLocation() {
  const loc = getPomoSettings().location || 'view';
  document.getElementById('sidebarPomodoro').style.display = loc === 'sidebar' ? '' : 'none';
  if (state.currentView === 'pomodoro' && loc === 'sidebar') state.currentView = state.mode === 'bbu' ? 'matrix' : 'timetable';
  buildViewDropdown();
  applyModeUI();
}
function initPomodoro() {
  document.querySelectorAll('.pomo-start').forEach(b => b.addEventListener('click', pomoStart));
  document.querySelectorAll('.pomo-reset').forEach(b => b.addEventListener('click', pomoReset));
  document.querySelectorAll('.pomo-finish').forEach(b => b.addEventListener('click', pomoFinishTask));
  document.querySelectorAll('.pomo-unlink').forEach(b => b.addEventListener('click', pomoUnlink));
  document.querySelectorAll('.pomo-settings').forEach(b => b.addEventListener('click', openPomoSettings));
  document.getElementById('pomoSettingsClose').addEventListener('click', closePomoSettings);
  setInterval(() => {
    if (pomoState.running && pomoState.endTime) {
      const rem = Math.max(0, (pomoState.endTime - Date.now()) / 1000);
      pomoState.secondsLeft = rem;
      if (rem <= 0) pomoCompleteInterval();
    }
    renderPomodoro();
  }, 500);
  applyPomoLocation();
  renderPomodoro();
}

migrateOldData();
migrateBbuData();
initBbuPanels();
initPomodoro();
renderPomodoro();
// Auto-collapse sidebar on mobile
if (window.innerWidth < 768) document.getElementById('sidebar').classList.add('collapsed');
renderSidebar();
applyModeUI();
