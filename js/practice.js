/* =========================================================
   Вкладка practice.
   Математика — задачи из банка ФИПИ (js/bank.js): сначала нерешённые,
   потом с ошибкой, решённые верно — в конце очереди. Варианты №1–5
   показываются целиком: картинки и поля ответов. Повтор — 10 задач,
   которых ещё не было, засчитан при 8 верных.
   Обществознание — тест темы (первое изучение и повторы) и бесконечная
   тренировка по вопросам всех вариантов.
   Над практикой — таймер (js/timer.js).
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;

  function mount(box, topic, onChange) {
    box.innerHTML = '';
    const subj = Subjects.of(topic.id);
    const intro = el('div', 'practice-intro');
    const stage = el('div', 'practice-stage');
    box.appendChild(intro);
    box.appendChild(stage);

    function paintIntro() {
      intro.innerHTML = '';
      const t = Progress.peek(topic.id) || {};
      const goal = Subjects.get(subj).goalMin;
      const min = Math.floor((t.practiceSec || 0) / 60);
      intro.appendChild(el('div', 'block-head', '<h3>practice</h3><span class="muted">' + min + '/' + goal + ' мин</span>'));
      if (subj === 'math') {
        const s = Bank.summary(topic);
        intro.appendChild(el('p', 'muted', 'Банк ФИПИ: ' + s.total + ' ' + UI.plural(s.total, ['задача', 'задачи', 'задач']) + ', верно решено ' + s.ok + '. Без лимита — решай, пока есть силы.'));
      } else {
        intro.appendChild(el('p', 'muted', 'Вопросы всех трёх вариантов теста по одному, без конца. Время идёт в зачёт темы.'));
      }
      const row = el('div', 'btn-row');
      if (subj === 'social') {
        const pick = Progress.pickVariant(topic.id);
        if (pick.mode !== 'practice') {
          row.appendChild(UI.button('btn btn-primary', pick.mode === 'first' ? '▸ Тест: вариант 1' : '▸ Повтор: тест', function () { begin('test'); }));
        }
      } else if (Progress.reviewDue(topic.id)) {
        row.appendChild(UI.button('btn btn-primary', '▸ Повтор: 10 задач', function () { begin('review'); }));
      }
      row.appendChild(UI.button('btn' + (row.children.length ? '' : ' btn-primary'), '▸ Практика без лимита', function () { begin('endless'); }));
      if (subj === 'social' && Progress.pickVariant(topic.id).mode === 'practice') {
        row.appendChild(UI.button('btn', 'Тест-тренировка', function () { begin('test'); }));
      }
      intro.appendChild(row);
      if (Progress.reviewDue(topic.id)) {
        intro.appendChild(el('p', 'note', subj === 'math'
          ? 'Сегодня повтор: 10 задач, которых ещё не было. Засчитан при 8 верных.'
          : 'Сегодня повтор: новый вариант теста, нужна «5».'));
      }
    }
    paintIntro();

    function begin(mode) {
      intro.hidden = true;
      stage.innerHTML = '';
      stage.appendChild(Timer.start(topic.id));
      const back = UI.button('btn btn-ghost btn-sm', '← назад', function () {
        Timer.stop();
        stage.innerHTML = '';
        intro.hidden = false;
        paintIntro();
        if (onChange) onChange();
      });
      stage.appendChild(back);
      const body = el('div', 'practice-body');
      stage.appendChild(body);
      if (mode === 'test') Quiz.test(body, topic, function () { if (onChange) onChange(); });
      else if (subj === 'social') Quiz.endless(body, topic);
      else if (mode === 'review') runReview(body, topic, function () { back.click(); });
      else runPractice(body, topic);
      stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ---------- Обычная практика ---------- */
  function runPractice(body, topic) {
    let seen = {}, queue = [];
    function next() {
      if (!queue.length) {
        queue = Bank.queue(topic, seen);
        if (!queue.length) { seen = {}; queue = Bank.queue(topic, seen); }
      }
      const u = queue.shift();
      body.innerHTML = '';
      if (!u) { body.appendChild(el('p', 'muted', 'Для этой темы задач нет.')); return; }
      seen[u.key] = true;
      const card = unit(u, { onNext: next });
      body.appendChild(card);
      Text.render(card);
    }
    next();
  }

  /* ---------- Повтор: 10 задач ---------- */
  function runReview(body, topic, onDone) {
    const set = Bank.reviewSet(topic, 10);
    let total = 0;
    set.forEach(function (u) { total += u.keys.length; });
    let done = 0, correct = 0, i = 0;
    const keys = [];
    const head = el('div', 'meter-label');
    body.parentNode.insertBefore(head, body);
    function paint() { head.textContent = 'повтор ' + done + '/' + total + ' · верно ' + correct; }
    paint();
    function next() {
      body.innerHTML = '';
      if (i >= set.length) return finish();
      const u = set[i++];
      keys.push(u.key);
      const card = unit(u, { review: true, onResult: function (ok, count) { done += count; correct += ok; paint(); }, onNext: next });
      body.appendChild(card);
      Text.render(card);
    }
    function finish() {
      const outcome = Progress.recordMathReview(topic.id, correct, total, keys);
      const passed = outcome.kind !== 'review-failed';
      const d = outcome.next ? Progress.human(outcome.next) : '';
      let text = 'Верно ' + correct + ' из ' + total + '. ';
      if (outcome.kind === 'review1-ok') text += 'Второй повтор — ' + d + '.';
      else if (outcome.kind === 'fixed') text += 'Тема закреплена: оба повтора пройдены.';
      else if (outcome.kind === 'mock-ok') text += 'Повтор засчитан.';
      else text += 'Нужно 8 верных. Пересдача ' + d + ', задачи будут другие.';
      const res = el('div', 'result card ' + (passed ? 'g5' : 'g2'), '<div class="grade">' + (passed ? '✓' : '✗') + '</div><div><b>' + (passed ? 'Повтор засчитан' : 'Повтор не засчитан') + '</b><p>' + esc(text) + '</p></div>');
      res.appendChild(UI.button('btn', 'К практике', onDone));
      head.remove();
      body.appendChild(res);
    }
    next();
  }

  /* =========================================================
     Карточка задачи или варианта
       opts.onNext()            — дальше;
       opts.onResult(ok, count) — итог (повтор, опрос);
       opts.review              — без «Пропустить»;
       opts.label               — своя подпись вместо названия банка.
     ========================================================= */
  function unit(u, opts) { return u.kind === 'variant' ? variant(u, opts) : task(u, opts); }

  function head(card, u, label, opts) {
    const h = el('div', 'q-head');
    h.appendChild(el('span', null, esc(opts.label || label)));
    h.appendChild(UI.button('link-btn', 'ошибка в задаче', function () {
      Bank.report(u.key);
      UI.toast('Задача ' + u.key + ' больше не попадётся.');
      if (opts.onResult && !card._resolved) opts.onResult(0, u.keys.length);
      opts.onNext();
    }));
    card.appendChild(h);
  }

  // Картинки вырезаны в одном масштабе: полная ширина страницы — 1100 px
  // (варианты №1–5 — 1300 px). Ширина карточки соответствует 850 px страницы:
  // мелкое выражение чуть крупнее, чем на бумаге, но не растянуто на всю строку.
  function zoomable(src, base, cls) {
    const b = el('button', 'task-img ' + (cls || ''));
    b.type = 'button';
    b.setAttribute('aria-label', 'Увеличить условие');
    b.innerHTML = '<img src="' + esc(src) + '" alt="Условие задачи" loading="lazy">';
    const img = b.firstChild;
    img.addEventListener('load', function () { img.style.width = Math.min(100, img.naturalWidth / (base || 850) * 100) + '%'; });
    img.addEventListener('error', function () { b.replaceWith(el('p', 'muted', 'Картинка не загрузилась — нужен интернет, чтобы скачать её в первый раз.')); });
    b.addEventListener('click', function () { UI.lightbox(src, { photo: cls === 'paper' }); });
    return b;
  }

  function answerHTML(t) {
    if (t.aimg) return '<img class="ans-img" src="' + esc(t.aimg) + '" alt="Ответ" loading="lazy">';
    if (t.a === null || t.a === undefined || t.a === '') return '<span class="muted">в банке ответа нет — сверь решение с шпорой</span>';
    return '<b>' + esc(String(t.a)) + '</b>';
  }

  function nextButton(where, opts) {
    const nb = UI.button('btn btn-primary', 'Дальше →', function () { opts.onNext(); });
    where.appendChild(nb);
    UI.nextOnEnter(nb);
  }

  /* ---------- Одна задача ---------- */
  function task(u, opts) {
    const t = u.task;
    const card = el('div', 'q card');
    head(card, u, Bank.title(u.bank) + ' · ' + t.id, opts);
    card.appendChild(zoomable(t.img));
    if (t.item) card.appendChild(el('p', 'note', 'Реши пункт ' + esc(t.item)));
    const instr = Bank.groupText(u.bank, t.g);
    if (instr) card.appendChild(el('p', 'muted', esc(instr)));
    const fb = el('div', 'feedback');
    const actions = el('div', 'q-actions');

    function resolve(ok, html, cls) {
      card._resolved = true;
      Bank.record(u.key, ok);
      if (opts.onResult) opts.onResult(ok ? 1 : 0, 1);
      fb.className = 'feedback ' + (cls || (ok ? 'ok' : 'bad'));
      fb.innerHTML = html;
      actions.innerHTML = '';
      nextButton(actions, opts);
    }

    function selfButtons(where) {
      const row = el('div', 'btn-row');
      row.appendChild(UI.button('btn', 'Решил верно', function () { resolve(true, '<span class="fb-title">засчитано</span>ответ: ' + answerHTML(t)); }));
      row.appendChild(UI.button('btn', 'Ошибся', function () { resolve(false, '<span class="fb-title">записано как ошибка</span>ответ: ' + answerHTML(t)); }));
      where.appendChild(row);
    }

    if (Bank.isNumeric(t)) {
      const form = el('form', 'answer-row');
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'ans-input';
      input.placeholder = t.check === 'digits' ? 'номера без пробелов' : 'ответ';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.inputMode = t.check === 'digits' ? 'numeric' : 'decimal';
      const btn = el('button', 'btn btn-primary', 'Проверить');
      btn.type = 'submit';
      form.appendChild(el('span', 'prompt', '&gt;'));
      form.appendChild(input);
      form.appendChild(btn);
      card.appendChild(form);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (card._resolved || card._pending) return;
        const res = Bank.check(t, input.value);
        if (!res) { input.focus(); return; }
        input.disabled = true;
        btn.remove();
        if (res === 'ok') { input.classList.add('right'); resolve(true, '<span class="fb-title">верно</span>'); }
        else if (res === 'sign') {
          card._pending = true;
          fb.className = 'feedback warn';
          fb.innerHTML = '<span class="fb-title">в банке мог потеряться минус — сверь решение</span>в банке: <b>' + esc(t.a) + '</b>, у тебя: <b>' + esc(input.value.trim()) + '</b>.';
          actions.innerHTML = '';
          selfButtons(fb);
        } else { input.classList.add('wrong'); resolve(false, '<span class="fb-title">неверно</span>правильный ответ: ' + answerHTML(t)); }
      });
      setTimeout(function () { if (document.body.contains(input)) input.focus({ preventScroll: true }); }, 60);
    }

    card.appendChild(fb);
    card.appendChild(actions);
    if (Bank.isNumeric(t)) {
      actions.appendChild(UI.button('btn btn-ghost', 'Не знаю — показать ответ', function () {
        const inp = card.querySelector('.ans-input');
        if (inp) inp.disabled = true;
        const b = card.querySelector('.answer-row .btn');
        if (b) b.remove();
        resolve(false, '<span class="fb-title">ответ</span>' + answerHTML(t), 'bad');
      }));
    } else {
      const reveal = UI.button('btn btn-primary', 'Показать ответ', function () {
        fb.className = 'feedback neutral';
        fb.innerHTML = '<span class="fb-title">ответ</span>' + answerHTML(t) + '<p>Сверь своё решение. Как получилось?</p>';
        reveal.remove();
        selfButtons(fb);
      });
      actions.appendChild(reveal);
    }
    if (!opts.review) actions.appendChild(UI.button('btn btn-ghost', 'Пропустить', function () { opts.onNext(); }));
    return card;
  }

  /* ---------- Вариант №1–5 целиком ---------- */
  function variant(u, opts) {
    const v = u.variant;
    const card = el('div', 'q card variant');
    head(card, u, Bank.title(u.bank) + ' · вариант ' + v.n, opts);
    const grid = el('div', 'variant-grid');
    const imgs = el('div', 'variant-imgs');
    v.images.forEach(function (src) { imgs.appendChild(zoomable(src, 1300, 'paper')); });
    grid.appendChild(imgs);
    const side = el('form', 'variant-answers');
    side.appendChild(el('div', 'eyebrow', 'ответы'));
    const rows = v.questions.map(function (q, qi) {
      const row = el('div', 'v-row');
      const label = el('label', 'v-num', esc(q.id));
      row.appendChild(label);
      let input = null;
      if (Bank.isNumeric(q)) {
        input = document.createElement('input');
        input.type = 'text';
        input.className = 'ans-input';
        input.autocomplete = 'off';
        input.inputMode = 'decimal';
        input.id = 'v-' + u.key.replace(/[^a-z0-9]/gi, '-') + '-' + qi;
        label.htmlFor = input.id;
        row.appendChild(input);
      } else {
        row.appendChild(el('span', 'muted', 'самопроверка'));
      }
      const note = el('div', 'v-note');
      row.appendChild(note);
      side.appendChild(row);
      return { q, input, row, note, state: null };
    });
    const checkBtn = el('button', 'btn btn-primary', 'Проверить вариант');
    checkBtn.type = 'submit';
    side.appendChild(checkBtn);
    grid.appendChild(side);
    card.appendChild(grid);
    const fb = el('div', 'feedback');
    const actions = el('div', 'q-actions');
    card.appendChild(fb);
    card.appendChild(actions);
    const show = UI.button('btn btn-ghost', 'Не знаю — показать ответы');
    actions.appendChild(show);
    if (!opts.review) actions.appendChild(UI.button('btn btn-ghost', 'Пропустить', function () { opts.onNext(); }));

    function settle(r, ok) {
      r.state = ok;
      r.row.classList.remove('pending');
      r.row.classList.add(ok ? 'right' : 'wrong');
      r.note.innerHTML = ok ? 'верно' : 'ответ: ' + answerHTML(r.q);
      maybeFinish();
    }
    function selfPick(r, html) {
      r.row.classList.add('pending');
      r.note.innerHTML = html;
      r.note.appendChild(UI.button('mini', 'верно', function () { settle(r, true); }));
      r.note.appendChild(UI.button('mini', 'ошибся', function () { settle(r, false); }));
    }
    function maybeFinish() {
      if (card._resolved || rows.some(function (r) { return r.state === null; })) return;
      card._resolved = true;
      let ok = 0;
      rows.forEach(function (r) { Bank.record(Bank.key(u.bank, r.q.id), r.state); if (r.state) ok++; });
      if (opts.onResult) opts.onResult(ok, rows.length);
      fb.className = 'feedback ' + (ok === rows.length ? 'ok' : 'bad');
      fb.innerHTML = '<span class="fb-title">' + (ok === rows.length ? 'весь вариант верно' : 'верно ' + ok + ' из ' + rows.length) + '</span>';
      actions.innerHTML = '';
      nextButton(actions, opts);
    }
    side.addEventListener('submit', function (e) {
      e.preventDefault();
      if (card._checked) return;
      card._checked = true;
      checkBtn.remove();
      show.remove();
      rows.forEach(function (r) {
        if (!r.input) { selfPick(r, 'ответ: ' + answerHTML(r.q) + ' '); return; }
        r.input.disabled = true;
        const res = Bank.check(r.q, r.input.value);
        if (res === 'ok') settle(r, true);
        else if (res === 'sign') selfPick(r, 'в банке ' + esc(r.q.a) + ' — мог потеряться минус. ');
        else settle(r, false);
      });
    });
    show.addEventListener('click', function () {
      card._checked = true;
      checkBtn.remove();
      show.remove();
      rows.forEach(function (r) { if (r.input) r.input.disabled = true; settle(r, false); });
    });
    return card;
  }

  window.Practice = { mount, unit };
})();
