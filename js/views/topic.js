/* =========================================================
   Страница темы: вкладки по порядку изучения
     video    — ролик Данира / Равиля (нет ролика — нет вкладки);
     notes    — шпора один в один: теория, объяснение, термины, примеры;
                долистал до конца — теория засчитана;
     review   — разбор реальных заданий ОГЭ по теме + видеоразбор с нужной минуты
                (нет заданий — нет вкладки);
     practice — тест / повтор / практика без лимита, таймер, опрос каждые 15 минут.
   Вкладка — в адресе: #/t/<id>/<вкладка>. Клавиши 1–4 переключают вкладки.
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;
  const LEVELS = { easy: 'базовый', mid: 'средний', hard: 'формат ОГЭ' };
  const TAB_NAMES = { video: 'video', notes: 'notes', review: 'review', practice: 'practice' };

  function reviewItems(id) {
    const tasks = (window.REVIEW_TASKS || []).filter(function (r) { return r.topics.indexOf(id) !== -1; });
    const clips = (window.REVIEW_CLIPS || []).filter(function (r) { return r.topics.indexOf(id) !== -1; });
    return { tasks, clips };
  }

  function tabsFor(topic) {
    const list = [];
    if ((window.VIDEOS || {})[topic.id]) list.push('video');
    list.push('notes');
    const r = reviewItems(topic.id);
    if (r.tasks.length || r.clips.length) list.push('review');
    list.push('practice');
    return list;
  }

  function render(view, found, wanted) {
    const topic = found.topic, subj = found.subject;
    Store.set('last', topic.id);
    view.classList.add('topic');
    const token = {};
    view._screen = token;

    /* ---------- Шапка ---------- */
    const head = el('div', 'topic-head');
    head.appendChild(el('div', 'kicker', esc(Subjects.get(subj).dir) + '/' + esc(topic.id) + ' · тема ' + String(topic.num).padStart(2, '0') + ' · ' + esc(topic.section)));
    head.appendChild(el('h1', 'topic-title', esc(topic.title)));
    const statusLine = el('div', 'status-line');
    head.appendChild(statusLine);
    view.appendChild(head);

    function paintStatus() {
      const st = Progress.status(topic.id);
      const parts = [];
      const cls = { 'new': 'dim', studied: 'ok', today: 'warn', overdue: 'bad', fixed: 'moon' }[st.code];
      parts.push('<span class="chip ' + cls + '">' + esc(st.code === 'new' ? st.label : st.label) + '</span>');
      if (topic.oge && topic.oge.length) parts.push('<span>огэ №' + esc(topic.oge.join(', ')) + '</span>');
      parts.push('<span>progress ' + Math.round(Progress.percent(topic.id)) + '%</span>');
      const left = Progress.missing(topic.id);
      if (left.length && st.code === 'new') {
        const t = Progress.peek(topic.id) || {};
        parts.push('<span>осталось: ' + left.map(function (k) {
          if (k === 'theory') return 'шпора';
          if (k === 'test') return 'тест на «5»';
          return 'практика ' + Math.floor((t.practiceSec || 0) / 60) + '/' + Subjects.get(subj).goalMin + ' мин';
        }).join(', ') + '</span>');
      }
      statusLine.innerHTML = parts.join('<span class="sep">·</span>');
    }
    paintStatus();

    /* ---------- Вкладки ---------- */
    const tabs = tabsFor(topic);
    let current = tabs.indexOf(wanted) !== -1 ? wanted : null;
    if (!current) {
      const saved = Store.get('tab:' + topic.id, null);
      current = Progress.isDue(topic.id) ? 'practice' : (tabs.indexOf(saved) !== -1 ? saved : tabs[0]);
    }
    const bar = el('div', 'tabs');
    bar.setAttribute('role', 'tablist');
    tabs.forEach(function (name, i) {
      const b = UI.button('tab', '<span class="k">' + (i + 1) + '</span>' + TAB_NAMES[name], function () { open(name); });
      b.setAttribute('role', 'tab');
      b.dataset.tab = name;
      bar.appendChild(b);
    });
    view.appendChild(bar);
    const panel = el('div', 'panel card');
    view.appendChild(panel);

    function open(name) {
      Timer.stop();
      current = name;
      Store.set('tab:' + topic.id, name);
      history.replaceState(null, '', '#/t/' + topic.id + '/' + name);
      bar.querySelectorAll('.tab').forEach(function (b) {
        const on = b.dataset.tab === name;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', String(on));
      });
      panel.innerHTML = '';
      panel.className = 'panel card panel-' + name;
      if (name === 'video') videoTab(panel, topic, subj);
      else if (name === 'notes') notesTab(panel, topic, subj, paintStatus);
      else if (name === 'review') reviewTab(panel, topic);
      else Practice.mount(panel, topic, paintStatus);
      const i = tabs.indexOf(name);
      if (name !== 'practice' && tabs[i + 1]) {
        const nx = UI.button('btn next-tab', 'дальше: ' + TAB_NAMES[tabs[i + 1]] + ' →', function () { open(tabs[i + 1]); window.scrollTo({ top: head.offsetTop, behavior: 'smooth' }); });
        panel.appendChild(nx);
      }
      Text.render(panel);
    }

    document.addEventListener('keydown', function onKey(e) {
      if (view._screen !== token) { document.removeEventListener('keydown', onKey); return; }
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= tabs.length && document.querySelector('.overlay') === null) open(tabs[n - 1]);
    });
    window.addEventListener('topic-closed', function onClosed(e) {
      if (view._screen !== token) { window.removeEventListener('topic-closed', onClosed); return; }
      if (e.detail.id === topic.id) paintStatus();
    });

    /* ---------- Низ: соседние темы и сброс ---------- */
    const foot = el('div', 'topic-foot');
    const prev = found.list[found.index - 1], next = found.list[found.index + 1];
    foot.appendChild(prev ? link(prev, '← ') : el('span'));
    foot.appendChild(UI.button('link-btn danger', 'сбросить прогресс темы', function () {
      if (!confirm('Сбросить прогресс по теме «' + topic.title + '»? Отметка «изучена», повторы, минуты практики и попытки удалятся.')) return;
      Timer.stop();
      Progress.resetTopic(topic.id);
      UI.toast('Прогресс темы сброшен.');
      App.route();
    }));
    foot.appendChild(next ? link(next, '', ' →') : el('span'));
    view.appendChild(foot);

    open(current);
  }

  function link(tp, before, after) {
    const a = el('a', 'foot-link', esc((before || '') + tp.title + (after || '')));
    a.href = '#/t/' + tp.id;
    return a;
  }

  /* =========================================================
     video
     ========================================================= */
  // Автор запретил показ на других сайтах (data/embeds.js) — такой ролик
  // открываем на YouTube в браузере, встроенный плеер показал бы только ошибку
  function embeddable(v) { return !(window.NO_EMBED && NO_EMBED[v.id]); }

  function player(box, v) {
    box.innerHTML = '';
    const inline = embeddable(v);
    const poster = UI.button('yt-poster' + (inline ? '' : ' external'),
      '<span class="yt-play">' + (inline ? '▶' : '↗') + '</span><span class="yt-title">' + esc(v.title) + (v.start ? ' · с ' + UI.clock(v.start) : '') + '</span>' +
      (inline ? '' : '<span class="yt-note">автор разрешил смотреть только на YouTube — откроется в браузере</span>'));
    poster.style.backgroundImage = 'url(https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg)';
    poster.addEventListener('click', function () {
      if (!navigator.onLine) { UI.toast('Нужен интернет, чтобы смотреть ролик.'); return; }
      if (!inline) { window.open(ytLink(v), '_blank', 'noopener'); return; }
      const f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + v.id + '?autoplay=1&rel=0&modestbranding=1' + (v.start ? '&start=' + v.start : '');
      f.title = v.title;
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      box.innerHTML = '';
      box.appendChild(f);
    });
    box.appendChild(poster);
  }

  function ytLink(v) { return 'https://www.youtube.com/watch?v=' + v.id + (v.start ? '&t=' + v.start + 's' : ''); }

  function videoTab(panel, topic, subj) {
    const list = VIDEOS[topic.id].filter(function (v) { return !(window.GONE && GONE[v.id]); });
    const author = VIDEO_AUTHORS[subj];
    panel.appendChild(el('div', 'block-head', '<h3>video</h3><a class="muted" href="' + author.channel + '" target="_blank" rel="noopener">' + esc(author.name) + ' ↗</a>'));
    const stage = el('div', 'player');
    panel.appendChild(stage);
    const meta = el('div', 'player-meta');
    panel.appendChild(meta);
    const rows = el('div', 'playlist');
    function pick(i) {
      player(stage, list[i]);
      meta.innerHTML = '<span>' + esc(list[i].title) + '</span><a href="' + ytLink(list[i]) + '" target="_blank" rel="noopener">открыть на YouTube ↗</a>';
      rows.querySelectorAll('.pl-row').forEach(function (r, j) { r.classList.toggle('on', j === i); });
    }
    if (list.length > 1) {
      list.forEach(function (v, i) {
        const where = embeddable(v) ? '<span class="pl-w in">▶ здесь</span>' : '<span class="pl-w">youtube ↗</span>';
        rows.appendChild(UI.button('pl-row', '<span class="pl-n">' + (i ? 'доп.' : 'основной') + '</span><span class="pl-t">' + esc(v.title) + '</span>' + where + '<span class="pl-d">' + esc(v.dur) + '</span>', function () { pick(i); }));
      });
      panel.appendChild(rows);
    }
    pick(0);
  }

  /* =========================================================
     notes — шпора один в один
     ========================================================= */
  function notesTab(panel, topic, subj, onRead) {
    const isMath = subj === 'math';
    const wrap = el('div', 'notes');
    const toc = el('nav', 'toc');
    toc.appendChild(el('div', 'eyebrow', 'contents'));
    const body = el('div', 'notes-body');
    topic.subtopics.forEach(function (sub, si) {
      const a = el('a', null, '<span>' + String(si + 1).padStart(2, '0') + '</span>' + Text.rich(sub.title));
      a.href = '#';
      a.addEventListener('click', function (e) { e.preventDefault(); body.querySelector('#sub-' + si).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      toc.appendChild(a);
      body.appendChild(subtopic(sub, si, isMath));
    });
    wrap.appendChild(toc);
    wrap.appendChild(body);
    panel.appendChild(wrap);

    // Материалы Равиля по теме
    const mats = materialsFor(topic);
    if (mats.length) {
      const box = el('div', 'notes-mats');
      box.appendChild(el('div', 'eyebrow', 'materials · ' + esc(MATERIALS.author)));
      mats.forEach(function (it) { box.appendChild(MaterialsView.row(it)); });
      body.appendChild(box);
    }

    // Конец шпоры: теория засчитывается, когда метка видна
    const t = Progress.peek(topic.id);
    const end = el('div', 'notes-end' + (t && t.theoryRead ? ' done' : ''), t && t.theoryRead ? '— шпора прочитана —' : '— долистай до этой строки, и шпора засчитается —');
    body.appendChild(end);
    if (!(t && t.theoryRead) && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const became = Progress.markTheoryRead(topic.id);
        end.classList.add('done');
        end.textContent = '— шпора прочитана —';
        UI.toast(became ? 'Тема изучена. Первый повтор — ' + Progress.human(Progress.status(topic.id).date) + '.' : (isMath ? 'Шпора прочитана. Дальше — разбор и практика.' : 'Шпора прочитана. Дальше — разбор, тест и практика.'), { kind: 'ok' });
        onRead();
      }, { threshold: 1 });
      io.observe(end);
    }
  }

  function materialsFor(topic) {
    if (!window.MATERIALS || Subjects.of(topic.id) !== 'social') return [];
    const out = [];
    MATERIALS.groups.forEach(function (g) {
      g.items.forEach(function (it) {
        if ((it.topics && it.topics.indexOf(topic.id) !== -1) || (it.sections && it.sections.indexOf(topic.section) !== -1)) out.push(it);
      });
    });
    return out;
  }

  function subtopic(sub, si, isMath) {
    const box = el('section', 'sub');
    box.id = 'sub-' + si;
    box.appendChild(el('h2', 'sub-title', '<span class="sub-num">' + String(si + 1).padStart(2, '0') + '</span><span>' + Text.rich(sub.title) + '</span>'));
    if (sub.source && sub.source.length) {
      const src = el('div', 'block src-block');
      src.appendChild(el('div', 'eyebrow', isMath ? 'шпаргалка' : 'шпора'));
      src.appendChild(Text.source(sub.source));
      box.appendChild(src);
    } else {
      box.appendChild(el('p', 'muted', isMath ? 'В шпаргалке этого нет — ниже объяснение по школьной программе.' : 'В шпоре отдельного текста нет — ниже материал из школьной программы.'));
    }
    if (sub.explain && sub.explain.length) {
      const ex = el('div', 'block explain');
      ex.appendChild(el('div', 'eyebrow', 'объяснение простыми словами'));
      sub.explain.forEach(function (p) { ex.appendChild(el('p', null, Text.rich(p))); });
      if (isMath && sub.terms && sub.terms.length) {
        const dl = el('dl', 'terms');
        sub.terms.forEach(function (term) { dl.appendChild(el('dt', null, Text.rich(term[0]))); dl.appendChild(el('dd', null, Text.rich(term[1]))); });
        ex.appendChild(dl);
      }
      box.appendChild(ex);
    }
    if (sub.examples && sub.examples.length) {
      const exs = el('div', 'block examples');
      exs.appendChild(el('div', 'eyebrow', 'примеры'));
      sub.examples.forEach(function (ex) { exs.appendChild(example(ex)); });
      box.appendChild(exs);
    }
    return box;
  }

  function example(ex) {
    const card = el('div', 'example');
    card.appendChild(el('span', 'level ' + ex.level, LEVELS[ex.level] || ''));
    card.appendChild(el('p', 'ex-task', Text.rich(ex.task)));
    card.appendChild(reveal(ex.steps || [], ex.answer, 'показать решение'));
    return card;
  }

  // Кнопка «показать решение» и раскрывающийся блок
  function reveal(steps, answer, label, extra) {
    const frag = document.createDocumentFragment();
    const btn = UI.button('btn btn-sm reveal-btn', label);
    btn.setAttribute('aria-expanded', 'false');
    const box = el('div', 'reveal');
    if (steps.length) {
      const ol = el('ol', 'steps');
      steps.forEach(function (s) { ol.appendChild(el('li', null, Text.rich(s))); });
      box.appendChild(ol);
    }
    if (extra) box.appendChild(extra);
    if (answer) box.appendChild(el('p', 'answer', '<span>ответ:</span> ' + Text.rich(answer)));
    btn.addEventListener('click', function () {
      const on = !box.classList.contains('on');
      box.classList.toggle('on', on);
      btn.textContent = on ? 'скрыть' : label;
      btn.setAttribute('aria-expanded', String(on));
    });
    frag.appendChild(btn);
    frag.appendChild(box);
    return frag;
  }

  /* =========================================================
     review — реальные задания ОГЭ и видеоразбор
     ========================================================= */
  function reviewTab(panel, topic) {
    const items = reviewItems(topic.id);
    panel.appendChild(el('div', 'block-head', '<h3>review</h3><span class="muted">реальные задания ОГЭ · решение · видеоразбор</span>'));
    panel.appendChild(el('p', 'muted', 'Сначала реши сам, потом открой решение. Кнопка ▶ включает видеоразбор этого задания с нужной минуты.'));
    items.tasks.forEach(function (r) { panel.appendChild(taskCard(r)); });
    if (items.clips.length) {
      const box = el('div', 'clips');
      box.appendChild(el('div', 'eyebrow', 'ещё видеоразборы по теме'));
      items.clips.forEach(function (c) {
        const v = c.video || REVIEW_SOURCES[c.src].video;
        const src = c.src ? REVIEW_SOURCES[c.src].title : v.title;
        const row = el('div', 'clip');
        const slot = el('div', 'player clip-player');
        slot.hidden = true;
        row.appendChild(UI.button('clip-btn', '<span class="yt-play">▶</span><span class="t">' + esc(c.title) + '</span><span class="m">' + esc(src) + (c.t ? ' · ' + UI.clock(c.t) : '') + '</span>', function () {
          slot.hidden = !slot.hidden;
          if (!slot.hidden && !slot.firstChild) player(slot, { id: v.id, title: c.title, start: c.t });
        }));
        row.appendChild(slot);
        box.appendChild(row);
      });
      panel.appendChild(box);
    }
  }

  function taskCard(r) {
    const src = REVIEW_SOURCES[r.src];
    const vsrc = REVIEW_SOURCES[r.vsrc || r.src];
    const card = el('div', 'rv card');
    const head = el('div', 'q-head');
    head.appendChild(el('span', null, esc(src.short) + ' · №' + r.n));
    const slot = el('div', 'player rv-player');
    slot.hidden = true;
    const vlabel = (r.vsrc ? 'аналог ' + vsrc.short + ' ' : '') + (r.t ? UI.clock(r.t) : 'весь разбор');
    head.appendChild(UI.button('link-btn', '▶ видеоразбор · ' + esc(vlabel), function () {
      slot.hidden = !slot.hidden;
      if (!slot.hidden && !slot.firstChild) player(slot, { id: vsrc.video.id, title: vsrc.video.title + ' · ' + vsrc.video.author, start: r.t || 0 });
    }));
    card.appendChild(head);
    if (r.vsrc && vsrc.note) slot.appendChild(el('p', 'muted small', esc(vsrc.note)));
    card.appendChild(slot);
    if (r.ctx) {
      const d = el('details', 'ctx');
      d.appendChild(el('summary', null, r.ctx === 'tires' ? 'условие к заданиям 1–5' : 'текст к заданиям 18–20'));
      d.appendChild(Text.source(REVIEW_CONTEXT[r.ctx]));
      card.appendChild(d);
    }
    card.appendChild(Text.source(r.q));
    if (r.img) card.insertAdjacentHTML('beforeend', Text.figure('img', r.img, r.photo));
    if (r.opts) {
      const ol = el('ol', 'opts');
      r.opts.forEach(function (o) { ol.appendChild(el('li', null, Text.rich(o))); });
      card.appendChild(ol);
    }
    const extra = r.simg ? el('div', null, Text.figure('img', r.simg)) : null;
    card.appendChild(reveal(r.steps || [], r.answer, 'показать решение', extra));
    return card;
  }

  window.TopicView = { render };
})();
