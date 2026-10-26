/* =========================================================
   Курсы (#/courses) — экран из модулей:
     today    — повторы на сегодня и следующая тема каждого предмета;
     stats    — изучено, закреплено, дни подряд, минуты;
     calendar — ближайшие 14 дней: повторы и новые темы по плану (js/views/calendar.js);
     social / math — списки тем по разделам.
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;

  // Глиф статуса в списках тем
  const GLYPH = { 'new': '·', started: '◦', studied: '✓', today: '↻', overdue: '!', fixed: '★' };

  function code(id) {
    const st = Progress.status(id);
    return st.code === 'new' && st.started ? 'started' : st.code;
  }

  function sections(subj) {
    const list = [], by = {};
    Subjects.get(subj).topics.forEach(function (tp) {
      if (!by[tp.section]) { by[tp.section] = { name: tp.section, topics: [] }; list.push(by[tp.section]); }
      by[tp.section].topics.push(tp);
    });
    return list;
  }

  function mod(name, meta, cls) {
    const box = el('section', 'mod ' + (cls || ''));
    box.appendChild(el('div', 'mod-head', '<span class="mod-name">' + name + '</span>' + (meta ? '<span class="mod-meta">' + meta + '</span>' : '')));
    const body = el('div', 'mod-body');
    box.appendChild(body);
    return { box, body };
  }

  function num(tp) { return String(tp.num).padStart(2, '0'); }

  /* ---------- today ---------- */
  function today() {
    const all = Subjects.all();
    const due = Progress.dueList(all);
    const m = mod('today', Progress.human(Progress.today()) + ' · ' + new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(), 'mod-today');
    const list = el('div', 'rows');
    due.forEach(function (tp) {
      const st = Progress.status(tp.id);
      list.appendChild(row(tp, st.code === 'overdue' ? 'overdue' : 'today', st.mock ? 'after mock exam' : st.label, '#/t/' + tp.id + '/practice'));
    });
    const last = Store.get('last', null);
    const lastFound = last && Subjects.find(last);
    if (lastFound && Progress.status(last).code === 'new') {
      list.appendChild(row(lastFound.topic, 'started', 'continue', '#/t/' + last));
    }
    Subjects.ORDER.forEach(function (s) {
      const next = Progress.nextNew(Subjects.get(s).topics.filter(function (tp) { return tp.id !== last; }));
      if (next) list.appendChild(row(next, 'new', 'next · ' + Subjects.get(s).dir, '#/t/' + next.id));
    });
    if (!list.children.length) list.appendChild(el('p', 'muted', 'All done for today.'));
    m.body.appendChild(list);
    if (PopQuiz.fixedTopics().length) {
      m.body.appendChild(UI.button('btn btn-sm', '▸ pop-quiz on mastered topics', PopQuiz.open));
    }
    return m.box;
  }

  function row(tp, kind, note, href) {
    const a = el('a', 'today-row st-' + kind);
    a.href = href;
    a.innerHTML = '<span class="glyph">' + GLYPH[kind] + '</span><span class="t">' + esc(tp.title) + '</span><span class="n">' + esc(note) + '</span>';
    return a;
  }

  /* ---------- stats ---------- */
  function stats() {
    const m = mod('stats', '', 'mod-stats');
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
      pct = Math.round(pct / topics.length);
      html += '<div class="stat-subj"><div class="kv"><span>' + Subjects.get(s).dir + '</span><b>' + pct + '%</b></div>' +
        '<div class="meter"><span style="width:' + pct + '%"></span></div>' +
        '<div class="kv small"><span>studied ' + studied + '/' + topics.length + '</span><span>mastered ' + fixed + '</span></div></div>';
    });
    const min = Math.round(Progress.daySec() / 60);
    html += '<div class="stat-grid">' +
      cell(Progress.streak(), 'day streak') + cell(min, 'min today') + cell(Bank.totalSolved(), 'tasks solved') + '</div>';
    m.body.innerHTML = html;
    return m.box;
  }
  function cell(v, label) { return '<div class="stat-cell"><b>' + v + '</b><span>' + label + '</span></div>'; }

  /* ---------- Списки тем ---------- */
  function topics(subj) {
    const s = Subjects.get(subj);
    const m = mod(subj === 'social' ? 'social' : 'math', s.topics.length + ' topics', 'mod-topics');
    sections(subj).forEach(function (sec) {
      const group = el('div', 'topic-group');
      const done = sec.topics.filter(function (tp) { return Progress.status(tp.id).code !== 'new'; }).length;
      group.appendChild(el('div', 'group-head', '<span>' + esc(sec.name) + '</span><span>' + done + '/' + sec.topics.length + '</span>'));
      sec.topics.forEach(function (tp) {
        const c = code(tp.id);
        const a = el('a', 'topic-row st-' + c);
        a.href = '#/t/' + tp.id;
        const oge = subj === 'math' && tp.oge ? '<span class="oge">№' + esc(tp.oge.join(',')) + '</span>' : '';
        a.innerHTML = '<span class="n">' + num(tp) + '</span><span class="t">' + esc(tp.title) + '</span>' + oge + '<span class="glyph" title="' + esc(Progress.status(tp.id).label) + '">' + GLYPH[c] + '</span>';
        group.appendChild(a);
      });
      m.body.appendChild(group);
    });
    return m.box;
  }

  function render(view) {
    view.classList.add('dash');
    view.appendChild(el('header', 'dash-head',
      '<h1 class="page-title">courses</h1>' +
      '<p class="page-lead">OGE · social studies and math: notes, videos, walkthroughs and unlimited practice.</p>'));
    view.appendChild(today());
    view.appendChild(stats());
    view.appendChild(CalendarView.module());
    view.appendChild(topics('social'));
    view.appendChild(topics('math'));
  }

  window.HomeView = { render };
})();
