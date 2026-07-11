/* ===== CONSTANTS ===== */
const HOUR_HEIGHT = 48;
const START_HOUR = 0;
const END_HOUR = 23;
const TOTAL_HOURS = END_HOUR - START_HOUR + 1;

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABELS = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ===== STATE ===== */
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
};

/* ===== DATE HELPERS ===== */
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

/* ===== VIEW SWITCHING ===== */
const viewSelector = document.getElementById('viewSelector');
const viewCurrent = document.getElementById('viewCurrent');
const viewDropdown = document.getElementById('viewDropdown');
const alertBadge = document.getElementById('alertBadge');
viewSelector.addEventListener('click', () => { viewSelector.classList.toggle('open'); });
document.addEventListener('click', (e) => { if (!viewSelector.contains(e.target)) viewSelector.classList.remove('open'); });

function switchView(view) {
  state.currentView = view;
  viewCurrent.textContent = view === 'timetable' ? 'TIMETABLE' : view === 'todo' ? 'TO DO LIST' : 'SETTINGS';
  viewSelector.classList.remove('open');
  document.getElementById('viewTimetable').style.display = view === 'timetable' ? '' : 'none';
  document.getElementById('viewTodo').style.display = view === 'todo' ? '' : 'none';
  document.getElementById('viewSettings').style.display = view === 'settings' ? '' : 'none';
  document.querySelector('.header-left').style.display = view === 'settings' ? 'none' : '';
  updateAlertBadge();
  if (view === 'todo') renderTodoList();
  else if (view === 'timetable') render();
}
viewDropdown.addEventListener('click', (e) => { const opt = e.target.closest('.view-option'); if (!opt) return; switchView(opt.dataset.view); });
function updateAlertBadge() { alertBadge.style.display = hasNearDeadlineTodos() ? 'inline-flex' : 'none'; }

/* ===== ADD BUTTON ===== */
document.getElementById('addBtn').addEventListener('click', () => {
  if (state.currentView === 'timetable') openAddModal();
  else openTodoAddModal();
});

/* ===== SIDEBAR ===== */
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
document.getElementById('sidebarSettingsBtn').addEventListener('click', () => { const s = getSettings(); document.getElementById('setNearImmediate').value = s.defaultNearImmediate; document.getElementById('setNearScheduled').value = s.defaultNearScheduled; document.getElementById('setPerTodoUrgency').checked = s.perTodoUrgency; switchView('settings'); });
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

/* ===== SETTINGS ===== */
document.getElementById('settingsBackBtn').addEventListener('click', () => { switchView('timetable'); });
document.getElementById('settingsSaveBtn').addEventListener('click', () => {
  saveSettings({
    defaultNearImmediate: parseInt(document.getElementById('setNearImmediate').value,10) || 24,
    defaultNearScheduled: parseInt(document.getElementById('setNearScheduled').value,10) || 48,
    perTodoUrgency: document.getElementById('setPerTodoUrgency').checked,
  });
  switchView('timetable'); renderTodoList(); updateAlertBadge();
});

/* ===== EXPORT / IMPORT ===== */
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
      // Refresh everything
      renderSidebar();
      render();
      renderTodoList();
      updateAlertBadge();
      switchView('timetable');
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  };
  reader.readAsText(file);
  // Reset so the same file can be re-imported
  e.target.value = '';
});

/* ===== RENDER: TIMETABLE ===== */
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

/* ===== CATEGORY SELECTOR ===== */
function renderCategorySelector() {
  const container = document.getElementById('categorySelector'), cats = getCategories(); container.innerHTML = '';
  cats.forEach(cat => { const opt = document.createElement('div'); opt.className = 'cat-option'; if (cat.id === state.selectedCategoryId) opt.classList.add('selected'); opt.innerHTML = `<span class="cat-dot" style="background:${cat.color}"></span><span class="cat-name">${esc(cat.name)}</span>`; opt.addEventListener('dblclick', (e) => { e.stopPropagation(); openCatEditModal(cat.id); }); opt.addEventListener('click', () => { state.selectedCategoryId = cat.id; document.querySelectorAll('.cat-option').forEach(el => el.classList.remove('selected')); opt.classList.add('selected'); if (getCategories().find(c => c.id === cat.id)) openLinkModal(cat.id); }); container.appendChild(opt); });
  if (!state.selectedCategoryId && cats.length > 0) { state.selectedCategoryId = cats[0].id; renderCategorySelector(); }
}

/* ===== LINK TODO MODAL ===== */
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

/* ===== CATEGORY MODAL ===== */
document.getElementById('addCategoryBtn').addEventListener('click', () => { state.editingCategoryId = null; document.getElementById('catName').value = ''; document.getElementById('catColor').value = '#6b7db3'; document.getElementById('catColorHex').textContent = '#6b7db3'; document.getElementById('catDeleteBtn').style.display = 'none'; document.querySelector('#catModal .modal-title').textContent = 'NEW CATEGORY'; openModalById('catModalOverlay'); });
document.getElementById('catColor').addEventListener('input', function() { document.getElementById('catColorHex').textContent = this.value; });
document.getElementById('catModalSave').addEventListener('click', () => { const name = document.getElementById('catName').value.trim(), color = document.getElementById('catColor').value; if (!name) { shakeBtn(document.getElementById('catModalSave')); return; } let cats = getCategories(); if (state.editingCategoryId) { const idx = cats.findIndex(c => c.id === state.editingCategoryId); if (idx !== -1) cats[idx] = { ...cats[idx], name, color }; } else cats.push({ id: genId(), name, color }); saveCategories(cats); closeModalById('catModalOverlay'); renderCategorySelector(); });
document.getElementById('catDeleteBtn').addEventListener('click', () => { if (!state.editingCategoryId || !confirm('Delete this category?')) return; saveCategories(getCategories().filter(c => c.id !== state.editingCategoryId)); closeModalById('catModalOverlay'); if (state.selectedCategoryId === state.editingCategoryId) state.selectedCategoryId = null; renderCategorySelector(); });
function openCatEditModal(id) { const cat = getCategories().find(c => c.id === id); if (!cat) return; state.editingCategoryId = id; document.getElementById('catName').value = cat.name; document.getElementById('catColor').value = cat.color; document.getElementById('catColorHex').textContent = cat.color; document.getElementById('catDeleteBtn').style.display = 'block'; document.querySelector('#catModal .modal-title').textContent = 'EDIT CATEGORY'; openModalById('catModalOverlay'); }
document.getElementById('catModalClose').addEventListener('click', () => closeModalById('catModalOverlay'));
document.getElementById('catModalCancel').addEventListener('click', () => closeModalById('catModalOverlay'));

/* ===== TIMETABLE ENTRY MODAL ===== */
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

/* ===== TODO LIST ===== */
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

/* ===== TODO MODAL ===== */
function openTodoAddModal() { state.editingTodoId = null; document.getElementById('todoName').value = ''; document.getElementById('todoDeadline').value = ''; setSelectedTodoType('casual'); document.getElementById('todoDeleteBtn').style.display = 'none'; document.getElementById('todoModalTitle').textContent = 'NEW TODO'; updateTodoNearField(); openModalById('todoModalOverlay'); requestAnimationFrame(() => document.getElementById('todoName').focus()); }
function openTodoEditModal(id) { const t = getTodos().find(x => x.id === id); if (!t) return; state.editingTodoId = id; document.getElementById('todoName').value = t.name; document.getElementById('todoDeadline').value = t.deadline ? t.deadline.slice(0,16) : ''; setSelectedTodoType(t.type); document.getElementById('todoNearThreshold').value = t.nearThreshold||''; document.getElementById('todoDeleteBtn').style.display = 'block'; document.getElementById('todoModalTitle').textContent = 'EDIT TODO'; updateTodoNearField(); openModalById('todoModalOverlay'); }
function setSelectedTodoType(type) { state.selectedTodoType = type; document.querySelectorAll('.todo-type-option').forEach(o => o.classList.toggle('selected', o.dataset.value === type)); updateTodoNearField(); }
function updateTodoNearField() { const s = getSettings(); document.getElementById('todoNearGroup').style.display = (s.perTodoUrgency && (state.selectedTodoType === 'immediate' || state.selectedTodoType === 'scheduled')) ? '' : 'none'; }
document.querySelectorAll('.todo-type-option').forEach(opt => { opt.addEventListener('click', () => setSelectedTodoType(opt.dataset.value)); opt.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTodoType(opt.dataset.value); } }); });
document.getElementById('todoModalSave').addEventListener('click', () => { const name = document.getElementById('todoName').value.trim(), deadline = document.getElementById('todoDeadline').value||null, type = state.selectedTodoType; const s = getSettings(); let nearThreshold = null; if (s.perTodoUrgency && (type === 'immediate' || type === 'scheduled')) { const v = document.getElementById('todoNearThreshold').value; if (v) nearThreshold = parseInt(v,10); } if (!name) { shakeBtn(document.getElementById('todoModalSave')); return; } let todos = getTodos(); if (state.editingTodoId) { const idx = todos.findIndex(x => x.id === state.editingTodoId); if (idx !== -1) todos[idx] = { ...todos[idx], name, deadline: deadline ? deadline+':00' : null, type, nearThreshold }; } else todos.push({ id: genId(), name, deadline: deadline ? deadline+':00' : null, type, nearThreshold, completed: false, createdAt: new Date().toISOString() }); saveTodos(todos); closeModalById('todoModalOverlay'); renderTodoList(); updateAlertBadge(); });
document.getElementById('todoDeleteBtn').addEventListener('click', () => { if (!state.editingTodoId || !confirm('Delete this todo?')) return; saveTodos(getTodos().filter(x => x.id !== state.editingTodoId)); closeModalById('todoModalOverlay'); renderTodoList(); updateAlertBadge(); });
document.getElementById('todoModalClose').addEventListener('click', () => closeModalById('todoModalOverlay'));
document.getElementById('todoModalCancel').addEventListener('click', () => closeModalById('todoModalOverlay'));

/* ===== MODAL HELPERS ===== */
function openModalById(id) { document.getElementById(id).classList.add('active'); }
function closeModalById(id) { document.getElementById(id).classList.remove('active'); }
['modalOverlay','catModalOverlay','linkModalOverlay','todoModalOverlay','instanceModalOverlay'].forEach(id => { document.getElementById(id).addEventListener('click', (e) => { if (e.target === document.getElementById(id)) closeModalById(id); }); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ['modalOverlay','catModalOverlay','linkModalOverlay','todoModalOverlay','instanceModalOverlay'].forEach(id => { if (document.getElementById(id).classList.contains('active')) closeModalById(id); }); });

/* ===== WEEK NAVIGATION ===== */
function rerenderCurrentView() { if (state.currentView === 'todo') renderTodoList(); else if (state.currentView === 'timetable') render(); }
document.getElementById('prevWeek').addEventListener('click', () => { state.weekOffset--; rerenderCurrentView(); });
document.getElementById('nextWeek').addEventListener('click', () => { state.weekOffset++; rerenderCurrentView(); });
document.getElementById('todayBtn').addEventListener('click', () => { state.weekOffset = 0; rerenderCurrentView(); });

/* ===== SCROLL SYNC ===== */
document.getElementById('timetableScroll').addEventListener('scroll', function() { const l = document.querySelector('.gutter-labels'); if (l) l.style.transform = `translateY(-${this.scrollTop}px)`; });

/* ===== SHAKE ===== */
const styleSheet = document.createElement('style');
styleSheet.textContent = '@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}';
document.head.appendChild(styleSheet);
function shakeBtn(btn) { btn.style.animation = 'shake 0.3s'; setTimeout(() => { btn.style.animation = ''; }, 300); }

/* ===== INIT ===== */
migrateOldData();
renderSidebar();
render();
updateAlertBadge();
