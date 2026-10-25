/* =========================================================
   Календарь тем в терминальном стиле.
     #/calendar[/ГГГГ-ММ] — месяц: в прошлых днях — минуты практики и что
       сделано (✓ изучено / сдан повтор), сегодня — повторы (! просрочено,
       ↻ на сегодня), в будущем — назначенные повторы и новые темы по плану (+).
       Сверху — план до ОГЭ по каждому предмету: даты экзаменов, нужный темп,
       твой темп и успеваешь ли. Клик по дню — список тем этого дня.
     CalendarView.module() — компактный модуль главной: ближайшие 14 дней.
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;
  const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(k) { const p = k.split('-'); return new Date(+p[0], +p[1] - 1, +(p[2] || 1)); }

  function title(id) { const f = Subjects.find(id); return f ? f.topic.title : id; }

  /* ---------- Клетка дня ---------- */
  function cell(d, opts) {
    const today = Progress.today();
    const delta = Progress.diffDays(today, d.key);
    const when = delta < 0 ? 'past' : delta === 0 ? 'today' : 'future';
    const b = el('button', 'cd ' + when + (d.exam.length ? ' exam' : '') + (opts.sel === d.key ? ' sel' : '') + (opts.dim ? ' dim' : ''));
    b.type = 'button';
    const n = parse(d.key).getDate();
    let a = '', c = '';
    const done = d.closed.length + d.passed.length;
    if (when === 'past') {
      a = d.minutes ? '<i class="m">' + d.minutes + '′</i>' : '<i class="z">·</i>';
      c = done ? '<i class="ok">✓' + done + '</i>' : '';
    } else if (when === 'today') {
      a = d.overdue.length ? '<i class="bad">!' + d.overdue.length + '</i>' : '';
      a += d.reviews.length ? '<i class="warn">↻' + d.reviews.length + '</i>' : '';
      if (!a) a = '<i class="z">·</i>';
      c = (d.minutes ? '<i class="m">' + d.minutes + '′</i>' : '') + (done ? '<i class="ok">✓' + done + '</i>' : '');
    } else {
      a = d.reviews.length ? '<i class="warn">↻' + d.reviews.length + '</i>' : '<i class="z">·</i>';
      c = d.planned.length ? '<i class="plan">+' + d.planned.length + '</i>' : '';
    }
    if (d.exam.length) c = '<i class="ex">oge</i>';
    b.innerHTML = '<span class="cd-n">' + (when === 'today' ? '[' + n + ']' : n) + '</span><span class="cd-a">' + a + '</span><span class="cd-b">' + c + '</span>';
    b.setAttribute('aria-label', d.key);
    b.addEventListener('click', function () { opts.onPick(d.key); });
    return b;
  }

  /* ---------- Подробности дня ---------- */
  function details(k) {
    const d = Plan.day(k);
    const delta = Progress.diffDays(Progress.today(), k);
    const date = parse(k);
    const box = el('div', 'cal-day');
    box.appendChild(el('div', 'cal-day-head', '<span class="prompt">$</span> day ' + k + ' <span class="muted">· ' + DOW[date.getDay()] + ' · ' + esc(Progress.human(k)) + '</span>'));
    function list(label, ids, cls, tab) {
      if (!ids.length) return;
      box.appendChild(el('div', 'cal-day-label ' + cls, esc(label) + ' · ' + ids.length));
      ids.forEach(function (id) {
        const a = el('a', 'cal-day-row');
        a.href = '#/t/' + id + (tab ? '/' + tab : '');
        a.innerHTML = '<span class="dir">' + esc(Subjects.get(Subjects.of(id)).dir) + '/</span>' + esc(title(id));
        box.appendChild(a);
      });
    }
    d.exam.forEach(function (s) { box.appendChild(el('div', 'cal-day-label ex', 'OGE · ' + esc(Subjects.get(s).name.toLowerCase()))); });
    list('overdue', d.overdue, 'bad', 'practice');
    list('review', d.reviews, 'warn', 'practice');
    list('new topics per plan', d.planned, 'plan');
    list('studied', d.closed, 'ok');
    list('review passed', d.passed, 'ok');
    if (delta <= 0) box.appendChild(el('div', 'cal-day-label', 'practice · ' + d.minutes + ' min'));
    if (box.children.length === 1 || (delta > 0 && !d.reviews.length && !d.planned.length && !d.exam.length)) {
      box.appendChild(el('div', 'muted small', delta > 0 ? '— free day —' : (d.minutes ? '' : '— no study —')));
    }
    return box;
  }

  /* ---------- План до ОГЭ ---------- */
  function fmt(x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); }

  function planBox(onChange) {
    const box = el('div', 'plan');
    const info = Plan.info();
    Subjects.ORDER.forEach(function (s) {
      const i = info[s];
      const row = el('div', 'plan-row');
      const label = el('label', 'plan-exam');
      label.innerHTML = '<span class="plan-subj">' + esc(Subjects.get(s).dir) + '</span><span class="muted">oge</span>';
      const input = document.createElement('input');
      input.type = 'date';
      input.value = i.exam;
      input.min = Progress.today();
      input.addEventListener('change', function () { Plan.setExam(s, input.value); onChange(); });
      label.appendChild(input);
      if (i.guess) label.appendChild(el('span', 'note', 'approximate — set the date'));
      row.appendChild(label);
      let verdict;
      if (!i.left) verdict = '<span class="ok">all topics studied — only reviews left</span>';
      else if (!i.have) verdict = '<span class="warn">no new topics in 2 weeks — get started, the plan is waiting</span>';
      else if (i.eta <= i.finish) verdict = '<span class="ok">on track: at your pace you\'ll finish ' + esc(Progress.human(i.eta)) + '</span>';
      else verdict = '<span class="bad">behind: at your pace you\'ll finish ' + esc(Progress.human(i.eta)) + ', but you need to by ' + esc(Progress.human(i.finish)) + '</span>';
      row.appendChild(el('div', 'plan-text',
        '<span><b>' + i.left + '</b> ' + UI.plural(i.left, ['topic', 'topics']) + ' left</span>' +
        '<span>new topics done by <b>' + esc(Progress.human(i.finish)) + '</b> <span class="muted">(3 weeks before the oge)</span></span>' +
        '<span>needed <b>' + fmt(i.need * 7) + '</b>/wk · your pace <b>' + fmt(i.have * 7) + '</b>/wk</span>' + verdict));
      box.appendChild(row);
    });
    return box;
  }

  function legend() {
    return el('div', 'cal-legend',
      '<span><i class="m">25′</i> minutes of practice</span><span><i class="ok">✓</i> studied / review passed</span>' +
      '<span><i class="bad">!</i> overdue</span><span><i class="warn">↻</i> review</span><span><i class="plan">+</i> new topic per plan</span><span><i class="ex">oge</i> exam</span>');
  }

  /* ---------- Экран месяца ---------- */
  function render(view, monthKey) {
    view.classList.add('page', 'page-wide');
    const today = Progress.today();
    let month = monthKey && /^\d{4}-\d{2}$/.test(monthKey) ? parse(monthKey) : parse(today.slice(0, 7));
    let sel = today.slice(0, 7) === key(month).slice(0, 7) ? today : key(month);

    function draw() {
      view.innerHTML = '';
      const m = el('section', 'mod');
      const head = el('div', 'mod-head');
      head.innerHTML = '<span class="mod-name">calendar</span>';
      const nav = el('span', 'cal-nav');
      nav.appendChild(UI.button('link-btn', '←', function () { shift(-1); }));
      nav.appendChild(el('span', 'cal-month', MONTHS[month.getMonth()] + ' ' + month.getFullYear()));
      nav.appendChild(UI.button('link-btn', '→', function () { shift(1); }));
      nav.appendChild(UI.button('link-btn', 'today', function () { month = parse(today.slice(0, 7)); sel = today; go(); }));
      head.appendChild(nav);
      m.appendChild(head);
      const body = el('div', 'mod-body');
      body.appendChild(planBox(draw));

      const grid = el('div', 'cal-grid');
      WEEK.forEach(function (w) { grid.appendChild(el('div', 'cal-dow', w)); });
      const first = new Date(month.getFullYear(), month.getMonth(), 1);
      const lead = (first.getDay() + 6) % 7;
      for (let i = 0; i < lead; i++) grid.appendChild(el('div', 'cd-empty'));
      const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const k = key(new Date(month.getFullYear(), month.getMonth(), d));
        grid.appendChild(cell(Plan.day(k), { sel, onPick: function (x) { sel = x; draw(); } }));
      }
      body.appendChild(grid);
      body.appendChild(legend());
      body.appendChild(details(sel));
      m.appendChild(body);
      view.appendChild(m);
    }
    function shift(n) { month = new Date(month.getFullYear(), month.getMonth() + n, 1); sel = key(month); go(); }
    // Месяц — в адресе, без перерисовки всего роутера
    function go() { history.replaceState(null, '', '#/calendar/' + key(month).slice(0, 7)); draw(); }
    draw();
  }

  /* ---------- Модуль главной: 14 дней ---------- */
  function module() {
    const box = el('section', 'mod mod-calendar');
    const info = Plan.info();
    const meta = Subjects.ORDER.map(function (s) {
      const i = info[s];
      return Subjects.get(s).dir + ' ' + i.left + ' topics by ' + Progress.human(i.finish);
    }).join(' · ');
    box.appendChild(el('div', 'mod-head', '<span class="mod-name">calendar</span><span class="mod-meta">' + esc(meta) + '</span>'));
    const body = el('div', 'mod-body');
    const grid = el('div', 'cal-grid compact');
    const start = parse(Progress.today());
    const shiftMon = (start.getDay() + 6) % 7;
    WEEK.forEach(function (w) { grid.appendChild(el('div', 'cal-dow', w)); });
    for (let i = -shiftMon; i < 14 - shiftMon; i++) {
      const k = Progress.addDays(Progress.today(), i);
      grid.appendChild(cell(Plan.day(k), { dim: i < 0, onPick: function (x) { location.hash = '#/calendar/' + x.slice(0, 7); } }));
    }
    body.appendChild(grid);
    const foot = el('div', 'cal-foot');
    foot.appendChild(legend());
    const a = el('a', 'cal-open', 'open calendar →');
    a.href = '#/calendar';
    foot.appendChild(a);
    body.appendChild(foot);
    box.appendChild(body);
    return box;
  }

  window.CalendarView = { render, module };
})();
