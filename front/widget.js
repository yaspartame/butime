// Desktop "today & tomorrow" widget. Read-only — renders data mirrored from the
// main window via IPC. Colour-coded only: each item gets a colour bar on its side,
// tasks are never labelled urgent/important, events are coloured by their category.
(function () {
  const $ = (id) => document.getElementById(id);

  document.getElementById('wdClose').addEventListener('click', () => {
    if (window.butime) window.butime.toggleWidget(false);
  });

  if (window.butime && window.butime.onWidgetData) {
    window.butime.onWidgetData((d) => render(d));
  }

  function render(d) {
    if (!d) return;
    renderDay('wdToday', d.today);
    renderDay('wdTomorrow', d.tomorrow);
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
