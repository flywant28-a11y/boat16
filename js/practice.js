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
      intro.appendChild(el('div', 'block-head', '<h3>practice</h3><span class="muted">' + min + '/' + goal + ' min</span>'));
      if (subj === 'math') {
        const s = Bank.summary(topic);
        intro.appendChild(el('p', 'muted', 'FIPI bank: ' + s.total + ' ' + UI.plural(s.total, ['task', 'tasks']) + ', solved correctly ' + s.ok + '. No limit — solve as long as you like.'));
      } else {
        intro.appendChild(el('p', 'muted', 'Questions from all three test variants one at a time, endlessly. Time counts toward the topic.'));
      }
      const row = el('div', 'btn-row');
      if (subj === 'social') {
        const pick = Progress.pickVariant(topic.id);
        if (pick.mode !== 'practice') {
          row.appendChild(UI.button('btn btn-primary', pick.mode === 'first' ? '▸ Test: variant 1' : '▸ Review: test', function () { begin('test'); }));
        }
      } else if (Progress.reviewDue(topic.id)) {
        row.appendChild(UI.button('btn btn-primary', '▸ Review: 10 tasks', function () { begin('review'); }));
      }
      row.appendChild(UI.button('btn' + (row.children.length ? '' : ' btn-primary'), '▸ Unlimited practice', function () { begin('endless'); }));
      if (subj === 'social' && Progress.pickVariant(topic.id).mode === 'practice') {
        row.appendChild(UI.button('btn', 'Practice test', function () { begin('test'); }));
      }
      intro.appendChild(row);
      if (Progress.reviewDue(topic.id)) {
        intro.appendChild(el('p', 'note', subj === 'math'
          ? 'Today\'s review: 10 tasks you haven\'t seen yet. Passed with 8 correct.'
          : 'Today\'s review: a new test variant, a 5 is required.'));
      }
    }
    paintIntro();

    function begin(mode) {
      intro.hidden = true;
      stage.innerHTML = '';
      stage.appendChild(Timer.start(topic.id));
      const back = UI.button('btn btn-ghost btn-sm', '← back', function () {
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
      if (!u) { body.appendChild(el('p', 'muted', 'No tasks for this topic.')); return; }
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
    function paint() { head.textContent = 'review ' + done + '/' + total + ' · correct ' + correct; }
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
      let text = 'Correct: ' + correct + ' of ' + total + '. ';
      if (outcome.kind === 'review1-ok') text += 'Second review — ' + d + '.';
      else if (outcome.kind === 'fixed') text += 'Topic mastered: both reviews passed.';
      else if (outcome.kind === 'mock-ok') text += 'Review passed.';
      else text += 'You need 8 correct. Retake ' + d + ' with different tasks.';
      const res = el('div', 'result card ' + (passed ? 'g5' : 'g2'), '<div class="grade">' + (passed ? '✓' : '✗') + '</div><div><b>' + (passed ? 'Review passed' : 'Review not passed') + '</b><p>' + esc(text) + '</p></div>');
      res.appendChild(UI.button('btn', 'Back to practice', onDone));
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
    h.appendChild(UI.button('link-btn', 'error in task', function () {
      Bank.report(u.key);
      UI.toast('Task ' + u.key + ' won\'t appear again.');
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
    b.setAttribute('aria-label', 'Enlarge the problem');
    b.innerHTML = '<img src="' + esc(src) + '" alt="Problem statement" loading="lazy">';
    const img = b.firstChild;
    img.addEventListener('load', function () { img.style.width = Math.min(100, img.naturalWidth / (base || 850) * 100) + '%'; });
    img.addEventListener('error', function () { b.replaceWith(el('p', 'muted', 'The image didn\'t load — you need internet to download it the first time.')); });
    b.addEventListener('click', function () { UI.lightbox(src, { photo: cls === 'paper' }); });
    return b;
  }

  function answerHTML(t) {
    if (t.aimg) return '<img class="ans-img" src="' + esc(t.aimg) + '" alt="Answer" loading="lazy">';
    if (t.a === null || t.a === undefined || t.a === '') return '<span class="muted">no answer in the bank — compare your solution with the cheat sheet</span>';
    return '<b>' + esc(String(t.a)) + '</b>';
  }

  function nextButton(where, opts) {
    const nb = UI.button('btn btn-primary', 'Next →', function () { opts.onNext(); });
    where.appendChild(nb);
    UI.nextOnEnter(nb);
  }

  /* ---------- Одна задача ---------- */
  function task(u, opts) {
    const t = u.task;
    const card = el('div', 'q card');
    head(card, u, Bank.title(u.bank) + ' · ' + t.id, opts);
    card.appendChild(zoomable(t.img));
    if (t.item) card.appendChild(el('p', 'note', 'Solve part ' + esc(t.item)));
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
      row.appendChild(UI.button('btn', 'Solved it', function () { resolve(true, '<span class="fb-title">counted</span>answer: ' + answerHTML(t)); }));
      row.appendChild(UI.button('btn', 'Got it wrong', function () { resolve(false, '<span class="fb-title">recorded as a mistake</span>answer: ' + answerHTML(t)); }));
      where.appendChild(row);
    }

    if (Bank.isNumeric(t)) {
      const form = el('form', 'answer-row');
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'ans-input';
      input.placeholder = t.check === 'digits' ? 'numbers without spaces' : 'answer';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.inputMode = t.check === 'digits' ? 'numeric' : 'decimal';
      const btn = el('button', 'btn btn-primary', 'Check');
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
        if (res === 'ok') { input.classList.add('right'); resolve(true, '<span class="fb-title">correct</span>'); }
        else if (res === 'sign') {
          card._pending = true;
          fb.className = 'feedback warn';
          fb.innerHTML = '<span class="fb-title">a minus sign may have been lost in the bank — check your solution</span>bank: <b>' + esc(t.a) + '</b>, yours: <b>' + esc(input.value.trim()) + '</b>.';
          actions.innerHTML = '';
          selfButtons(fb);
        } else { input.classList.add('wrong'); resolve(false, '<span class="fb-title">incorrect</span>correct answer: ' + answerHTML(t)); }
      });
      setTimeout(function () { if (document.body.contains(input)) input.focus({ preventScroll: true }); }, 60);
    }

    card.appendChild(fb);
    card.appendChild(actions);
    if (Bank.isNumeric(t)) {
      actions.appendChild(UI.button('btn btn-ghost', 'Don\'t know — show answer', function () {
        const inp = card.querySelector('.ans-input');
        if (inp) inp.disabled = true;
        const b = card.querySelector('.answer-row .btn');
        if (b) b.remove();
        resolve(false, '<span class="fb-title">answer</span>' + answerHTML(t), 'bad');
      }));
    } else {
      const reveal = UI.button('btn btn-primary', 'Show answer', function () {
        fb.className = 'feedback neutral';
        fb.innerHTML = '<span class="fb-title">answer</span>' + answerHTML(t) + '<p>Compare with your solution. How did it go?</p>';
        reveal.remove();
        selfButtons(fb);
      });
      actions.appendChild(reveal);
    }
    if (!opts.review) actions.appendChild(UI.button('btn btn-ghost', 'Skip', function () { opts.onNext(); }));
    return card;
  }

  /* ---------- Вариант №1–5 целиком ---------- */
  function variant(u, opts) {
    const v = u.variant;
    const card = el('div', 'q card variant');
    head(card, u, Bank.title(u.bank) + ' · variant ' + v.n, opts);
    const grid = el('div', 'variant-grid');
    const imgs = el('div', 'variant-imgs');
    v.images.forEach(function (src) { imgs.appendChild(zoomable(src, 1300, 'paper')); });
    grid.appendChild(imgs);
    const side = el('form', 'variant-answers');
    side.appendChild(el('div', 'eyebrow', 'answers'));
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
        row.appendChild(el('span', 'muted', 'self-check'));
      }
      const note = el('div', 'v-note');
      row.appendChild(note);
      side.appendChild(row);
      return { q, input, row, note, state: null };
    });
    const checkBtn = el('button', 'btn btn-primary', 'Check variant');
    checkBtn.type = 'submit';
    side.appendChild(checkBtn);
    grid.appendChild(side);
    card.appendChild(grid);
    const fb = el('div', 'feedback');
    const actions = el('div', 'q-actions');
    card.appendChild(fb);
    card.appendChild(actions);
    const show = UI.button('btn btn-ghost', 'Don\'t know — show answers');
    actions.appendChild(show);
    if (!opts.review) actions.appendChild(UI.button('btn btn-ghost', 'Skip', function () { opts.onNext(); }));

    function settle(r, ok) {
      r.state = ok;
      r.row.classList.remove('pending');
      r.row.classList.add(ok ? 'right' : 'wrong');
      r.note.innerHTML = ok ? 'correct' : 'answer: ' + answerHTML(r.q);
      maybeFinish();
    }
    function selfPick(r, html) {
      r.row.classList.add('pending');
      r.note.innerHTML = html;
      r.note.appendChild(UI.button('mini', 'correct', function () { settle(r, true); }));
      r.note.appendChild(UI.button('mini', 'wrong', function () { settle(r, false); }));
    }
    function maybeFinish() {
      if (card._resolved || rows.some(function (r) { return r.state === null; })) return;
      card._resolved = true;
      let ok = 0;
      rows.forEach(function (r) { Bank.record(Bank.key(u.bank, r.q.id), r.state); if (r.state) ok++; });
      if (opts.onResult) opts.onResult(ok, rows.length);
      fb.className = 'feedback ' + (ok === rows.length ? 'ok' : 'bad');
      fb.innerHTML = '<span class="fb-title">' + (ok === rows.length ? 'whole variant correct' : 'correct ' + ok + ' of ' + rows.length) + '</span>';
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
        if (!r.input) { selfPick(r, 'answer: ' + answerHTML(r.q) + ' '); return; }
        r.input.disabled = true;
        const res = Bank.check(r.q, r.input.value);
        if (res === 'ok') settle(r, true);
        else if (res === 'sign') selfPick(r, 'bank: ' + esc(r.q.a) + ' — a minus sign may have been lost. ');
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
