(function () {
  const modeEl = document.getElementById('ovMode');
  const timeEl = document.getElementById('ovTime');
  const progEl = document.getElementById('ovProgress');
  const titleEl = document.getElementById('ovTitle');

  document.getElementById('ovClose').addEventListener('click', () => {
    if (window.butime) window.butime.toggleOverlay(false);
  });

  if (window.butime && window.butime.onPomoState) {
    window.butime.onPomoState((s) => {
      modeEl.textContent = s.modeStr || 'FOCUS';
      timeEl.textContent = s.timeStr || '25:00';
      timeEl.classList.toggle('break', !!s.isBreak);
      timeEl.classList.toggle('done', !!s.done);
      progEl.innerHTML = '';
      const total = s.longBreakEvery || 4;
      const done = s.sessionDone || 0;
      for (let i = 0; i < total; i++) {
        const d = document.createElement('span');
        if (i < done) d.classList.add('done');
        progEl.appendChild(d);
      }
      if (s.title) {
        titleEl.textContent = s.title;
        titleEl.style.display = '';
      } else {
        titleEl.style.display = 'none';
      }
    });
  }
})();
