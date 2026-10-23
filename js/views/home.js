/* =========================================================
   Главный экран из модулей:
     today    — повторы на сегодня и следующая тема каждого предмета;
     stats    — изучено, закреплено, дни подряд, минуты;
     calendar — календарь тем (логика старого сайта: статусы и повторы;
                внешний вид временный — обсуждается отдельно);
     social / math — списки тем по разделам с поиском из верхней панели.
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;

  const SHORT = {
    'Человек и общество': 'человек', 'Сфера духовной культуры': 'культура', 'Социальная сфера': 'социум',
    'Экономика': 'экономика', 'Политика': 'политика', 'Гражданин и государство': 'государство', 'Право': 'право',
    'Задания 1–5: практические задачи': '№1–5', 'Числа и выражения': 'числа', 'Уравнения, неравенства, текстовые задачи': 'уравнения',
    'Функции и графики': 'функции', 'Вероятность и прогрессии': 'вероятн.', 'Геометрия: углы и треугольники': 'треуг.',
    'Геометрия: четырёхугольники и окружность': 'четырёхуг.'
  };

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
    const m = mod('today', Progress.human(Progress.today()) + ' · ' + new Date().toLocaleDateString('ru-RU', { weekday: 'long' }), 'mod-today');
    const list = el('div', 'rows');
    due.forEach(function (tp) {
      const st = Progress.status(tp.id);
      list.appendChild(row(tp, st.code === 'overdue' ? 'overdue' : 'today', st.mock ? 'по пробнику' : st.label, '#/t/' + tp.id + '/practice'));
    });
    const last = Store.get('last', null);
    const lastFound = last && Subjects.find(last);
    if (lastFound && Progress.status(last).code === 'new') {
      list.appendChild(row(lastFound.topic, 'started', 'продолжить', '#/t/' + last));
    }
    Subjects.ORDER.forEach(function (s) {
      const next = Progress.nextNew(Subjects.get(s).topics.filter(function (tp) { return tp.id !== last; }));
      if (next) list.appendChild(row(next, 'new', 'следующая · ' + Subjects.get(s).dir, '#/t/' + next.id));
    });
    if (!list.children.length) list.appendChild(el('p', 'muted', 'На сегодня всё сделано.'));
    m.body.appendChild(list);
    if (PopQuiz.fixedTopics().length) {
      m.body.appendChild(UI.button('btn btn-sm', '▸ pop-quiz по закреплённым темам', PopQuiz.open));
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
        '<div class="kv small"><span>изучено ' + studied + '/' + topics.length + '</span><span>закреплено ' + fixed + '</span></div></div>';
    });
    const min = Math.round(Progress.daySec() / 60);
    html += '<div class="stat-grid">' +
      cell(Progress.streak(), 'дней подряд') + cell(min, 'мин сегодня') + cell(Bank.totalSolved(), 'задач верно') + '</div>';
    m.body.innerHTML = html;
    return m.box;
  }
  function cell(v, label) { return '<div class="stat-cell"><b>' + v + '</b><span>' + label + '</span></div>'; }

  /* ---------- calendar ---------- */
  function calendar() {
    const all = Subjects.all();
    const m = mod('calendar', all.length + ' тем · визуал временный', 'mod-calendar');
    const tip = el('div', 'cal-tip');
    Subjects.ORDER.forEach(function (s) {
      const block = el('div', 'cal-subj');
      block.appendChild(el('div', 'cal-subj-name', Subjects.get(s).dir));
      sections(s).forEach(function (sec) {
        const line = el('div', 'cal-line');
        line.appendChild(el('span', 'cal-sec', esc(SHORT[sec.name] || sec.name)));
        const cells = el('span', 'cal-cells');
        sec.topics.forEach(function (tp) {
          const c = code(tp.id);
          const a = el('a', 'cal-cell st-' + c);
          a.href = '#/t/' + tp.id;
          a.setAttribute('aria-label', tp.title + ' — ' + Progress.status(tp.id).label);
          a._tp = tp;
          cells.appendChild(a);
        });
        line.appendChild(cells);
        block.appendChild(line);
      });
      m.body.appendChild(block);
    });
    m.body.appendChild(el('div', 'cal-legend',
      ['new:не начата', 'started:начата', 'studied:изучена', 'today:повтор сегодня', 'overdue:просрочено', 'fixed:закреплена'].map(function (p) {
        const kv = p.split(':');
        return '<span><i class="cal-cell st-' + kv[0] + '"></i>' + kv[1] + '</span>';
      }).join('')));
    m.box.appendChild(tip);

    function show(a) {
      const tp = a._tp, st = Progress.status(tp.id);
      tip.innerHTML = '<b>' + esc(tp.title) + '</b><span>' + esc(st.label) + (st.date ? ' · ' + Progress.human(st.date) : '') + ' · ' + Math.round(Progress.percent(tp.id)) + '%</span>';
      const b = m.box.getBoundingClientRect(), c = a.getBoundingClientRect();
      tip.classList.add('on');
      const w = tip.offsetWidth;
      tip.style.left = Math.max(8, Math.min(c.left - b.left + c.width / 2 - w / 2, b.width - w - 8)) + 'px';
      tip.style.top = (c.top - b.top - tip.offsetHeight - 8) + 'px';
    }
    m.box.addEventListener('mouseover', function (e) { const a = e.target.closest('.cal-cell[href]'); if (a) show(a); });
    m.box.addEventListener('mouseout', function (e) { if (e.target.closest('.cal-cell[href]')) tip.classList.remove('on'); });
    return m.box;
  }

  /* ---------- Списки тем ---------- */
  function topics(subj) {
    const s = Subjects.get(subj);
    const m = mod(subj === 'social' ? 'social' : 'math', s.topics.length + ' тем', 'mod-topics');
    sections(subj).forEach(function (sec) {
      const group = el('div', 'topic-group');
      const done = sec.topics.filter(function (tp) { return Progress.status(tp.id).code !== 'new'; }).length;
      group.appendChild(el('div', 'group-head', '<span>' + esc(sec.name) + '</span><span>' + done + '/' + sec.topics.length + '</span>'));
      sec.topics.forEach(function (tp) {
        const c = code(tp.id);
        const a = el('a', 'topic-row st-' + c);
        a.href = '#/t/' + tp.id;
        a.setAttribute('data-q', Text.normalize(tp.title + ' ' + (tp.oge ? tp.oge.join(' ') : '') + ' ' + sec.name));
        const oge = subj === 'math' && tp.oge ? '<span class="oge">№' + esc(tp.oge.join(',')) + '</span>' : '';
        a.innerHTML = '<span class="n">' + num(tp) + '</span><span class="t">' + esc(tp.title) + '</span>' + oge + '<span class="glyph" title="' + esc(Progress.status(tp.id).label) + '">' + GLYPH[c] + '</span>';
        group.appendChild(a);
      });
      m.body.appendChild(group);
    });
    return m.box;
  }

  function filter(root, q) {
    q = Text.normalize(q || '').trim();
    root.querySelectorAll('.mod-topics').forEach(function (mb) {
      mb.querySelectorAll('.topic-group').forEach(function (g) {
        let any = false;
        g.querySelectorAll('.topic-row').forEach(function (r) {
          const hit = !q || r.getAttribute('data-q').indexOf(q) !== -1;
          r.hidden = !hit;
          if (hit) any = true;
        });
        g.hidden = !any;
      });
    });
    root.classList.toggle('filtering', !!q);
  }

  function render(view) {
    view.classList.add('dash');
    view.appendChild(today());
    view.appendChild(stats());
    view.appendChild(calendar());
    view.appendChild(topics('social'));
    view.appendChild(topics('math'));
    const input = document.querySelector('.search input');
    if (input && input.value) filter(view, input.value);
    // Роутер переиспользует элемент view — слушатель живёт, пока не отрисован другой экран
    const token = {};
    view._screen = token;
    window.addEventListener('topic-filter', function onFilter(e) {
      if (view._screen !== token) { window.removeEventListener('topic-filter', onFilter); return; }
      filter(view, e.detail.q);
    });
  }

  window.HomeView = { render };
})();
