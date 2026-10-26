/* =========================================================
   stats (#/stats) — монитор прогресса в духе btop:
     progress — шкалы по предметам: изучено, закреплено, средний процент;
     minutes  — минуты практики за 14 дней столбиками;
     totals   — серия, минуты, решённые задачи;
     topics   — «процессы»: начатые и изученные темы, сначала повторы.
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;
  const CELLS = 28;

  function mod(name, meta, cls) {
    const box = el('section', 'mod ' + (cls || ''));
    box.appendChild(el('div', 'mod-head', '<span class="mod-name">' + name + '</span>' + (meta ? '<span class="mod-meta">' + meta + '</span>' : '')));
    const body = el('div', 'mod-body');
    box.appendChild(body);
    return { box, body };
  }

  // Шкала из клеток: заполненные — с переходом цвета, как в btop
  function cells(pct) {
    const n = Math.round(pct / 100 * CELLS);
    let s = '';
    for (let i = 0; i < CELLS; i++) s += i < n ? '<i style="--k:' + (i / (CELLS - 1)).toFixed(2) + '">■</i>' : '<i class="e">■</i>';
    return '<span class="bt-cells" role="img" aria-label="' + Math.round(pct) + '%">' + s + '</span>';
  }

  function progress() {
    const m = mod('progress', 'studied · mastered', 'bt-prog');
    let html = '';
    Subjects.ORDER.forEach(function (s) {
      const topics = Subjects.get(s).topics;
      let studied = 0, fixed = 0, pct = 0;
      topics.forEach(function (tp) {
        const c = Progress.status(tp.id).code;
        if (c !== 'new') studied++;
        if (c === 'fixed') fixed++;
        pct += Progress.percent(tp.id);
      });
      pct = pct / topics.length;
      html += '<div class="bt-row"><span class="bt-k">' + s + '</span>' + cells(pct) + '<b>' + String(Math.round(pct)).padStart(3, ' ') + '%</b></div>' +
        '<div class="bt-sub">studied ' + studied + '/' + topics.length + ' · mastered ' + fixed + '</div>';
    });
    m.body.innerHTML = html;
    return m.box;
  }

  function minutes() {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const k = Progress.addDays(Progress.today(), -i);
      days.push({ k, min: Math.round(Progress.daySec(k) / 60) });
    }
    const max = Math.max(30, Math.max.apply(null, days.map(function (d) { return d.min; })));
    const total = days.reduce(function (a, d) { return a + d.min; }, 0);
    const m = mod('minutes', '14 days · ' + total + ' min', 'bt-min');
    const chart = el('div', 'bt-chart');
    days.forEach(function (d, i) {
      const col = el('div', 'bt-col' + (i === days.length - 1 ? ' now' : ''));
      col.title = d.k + ' · ' + d.min + ' min';
      col.innerHTML = '<span class="bt-v">' + (d.min || '') + '</span><span class="bt-b" style="height:' + (d.min / max * 100).toFixed(1) + '%"></span><span class="bt-d">' + d.k.slice(8) + '</span>';
      chart.appendChild(col);
    });
    m.body.appendChild(chart);
    return m.box;
  }

  function totals() {
    const m = mod('totals', '', 'bt-tot');
    const st = Progress.streak();
    m.body.innerHTML =
      '<div class="bt-kv"><span>streak</span><b>' + st + ' ' + UI.plural(st, ['day', 'days']) + '</b></div>' +
      '<div class="bt-kv"><span>today</span><b>' + Math.round(Progress.daySec() / 60) + ' min</b></div>' +
      '<div class="bt-kv"><span>tasks solved</span><b>' + Bank.totalSolved() + '</b></div>' +
      '<div class="bt-kv"><span>reviews due</span><b>' + Progress.dueList(Subjects.all()).length + '</b></div>';
    return m.box;
  }

  const ORDER = { overdue: 0, today: 1, 'new': 2, studied: 3, fixed: 4 };

  function topics() {
    const list = Subjects.all().filter(function (tp) { const st = Progress.status(tp.id); return st.code !== 'new' || st.started; });
    list.sort(function (a, b) {
      const sa = Progress.status(a.id), sb = Progress.status(b.id);
      return (ORDER[sa.code] - ORDER[sb.code]) || (Progress.percent(b.id) - Progress.percent(a.id));
    });
    const m = mod('topics', list.length + ' in progress', 'bt-proc');
    if (!list.length) {
      m.body.appendChild(el('p', 'muted', 'Nothing here yet. Open a topic and read its notes — it will show up in this list.'));
      return m.box;
    }
    const table = el('div', 'bt-table');
    table.appendChild(el('div', 'bt-tr bt-th', '<span>no</span><span>topic</span><span>status</span><span>%</span><span>min</span>'));
    list.forEach(function (tp) {
      const st = Progress.status(tp.id);
      const t = Progress.peek(tp.id) || {};
      const a = el('a', 'bt-tr st-' + st.code);
      a.href = '#/t/' + tp.id + (Progress.isDue(tp.id) ? '/practice' : '');
      a.innerHTML = '<span class="dim">' + Term.fname(tp).slice(0, 2) + '</span><span class="t"><span class="dim">' + Subjects.of(tp.id) + '/</span>' + esc(tp.title) + '</span>' +
        '<span class="s">' + esc(st.label) + '</span><span>' + Math.round(Progress.percent(tp.id)) + '</span><span>' + Math.floor((t.practiceSec || 0) / 60) + '</span>';
      table.appendChild(a);
    });
    m.body.appendChild(table);
    return m.box;
  }

  function render(view) {
    view.classList.add('btop');
    view.appendChild(progress());
    view.appendChild(totals());
    view.appendChild(minutes());
    view.appendChild(topics());
  }

  window.StatsView = { render };
})();
