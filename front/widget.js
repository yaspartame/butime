// Desktop "today & tomorrow" widget. Read-only — renders data mirrored from the
// main window via IPC. Colour-coded only: each item gets a colour bar on its side,
// tasks are never labelled urgent/important, events are coloured by their category.
(function () {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const WID = params.get('id') || 'w1';
  const isMain = WID === 'w1';

  // X closes this widget (main persists as hidden; added ones close entirely).
  document.getElementById('wdClose').addEventListener('click', () => {
    if (window.butime) window.butime.widgetClose(WID);
  });

  // "+" to add another instance — only the main widget has it.
  const addWrap = document.getElementById('wdAddWrap');
  if (!isMain && addWrap) addWrap.style.display = 'none';
  const addBtn = document.getElementById('wdAdd');
  const menu = document.getElementById('wdAddMenu');
  if (addBtn) {
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    menu.addEventListener('click', (e) => {
      const it = e.target.closest('.wd-inst');
      if (!it || it.classList.contains('wd-inst-empty')) return;
      if (window.butime) window.butime.widgetAdd(it.dataset.instance);
      menu.classList.remove('open');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.wd-add-wrap')) menu.classList.remove('open');
    });
  }

  if (window.butime && window.butime.onWidgetData) {
    window.butime.onWidgetData((p) => render(p));
  }
  // Just loaded — ask the app to send us fresh data.
  if (window.butime && window.butime.widgetGetData) window.butime.widgetGetData(WID);

  function render(p) {
    if (!p) return;
    $('wdTitle').textContent = String(p.instanceName || '').toUpperCase() || 'TODAY & TOMORROW';
    renderDay('wdToday', p.data && p.data.today);
    renderDay('wdTomorrow', p.data && p.data.tomorrow);
    if (menu) {
      menu.innerHTML = '';
      const avail = p.availableInstances || [];
      if (!avail.length) {
        const e = document.createElement('div');
        e.className = 'wd-inst wd-inst-empty';
        e.textContent = 'No more instances';
        menu.appendChild(e);
      } else {
        avail.forEach(inst => {
          const it = document.createElement('div');
          it.className = 'wd-inst';
          it.dataset.instance = inst.id;
          it.textContent = inst.name;
          menu.appendChild(it);
        });
      }
    }
  }

  function renderDay(prefix, day) {
    if (!day) return;
    $(prefix + 'Sub').textContent = day.label || '';
    renderList($(prefix + 'Tasks'), day.tasks);
    renderList($(prefix + 'Events'), day.events);
  }

  function renderList(el, items) {
    el.innerHTML = '';
    if (!items || !items.length) {
      const e = document.createElement('div');
      e.className = 'wd-empty';
      e.textContent = '—';
      el.appendChild(e);
      return;
    }
    items.forEach(it => {
      const row = document.createElement('div');
      row.className = 'wd-item';
      row.style.setProperty('--c', it.color);
      const time = it.time ? `<span class="wd-time">${it.time}</span>` : '';
      row.innerHTML = `<span class="wd-name">${esc(it.name)}</span>${time}`;
      el.appendChild(row);
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
