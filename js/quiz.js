/* =========================================================
   Тесты обществознания (поле tests в data/social.js).
   Типы вопросов: one — один ответ, many — несколько, match — соответствие,
   term — вписать термин. Оценка: 5 — от 90 %, 4 — от 70 %, 3 — от 50 %.
     Quiz.question(topic, q, n, total, onAnswered) — карточка вопроса;
     Quiz.test(box, topic, onFinish)  — вариант теста (первое изучение / повтор);
     Quiz.endless(box, topic)         — бесконечная тренировка по всем вариантам.
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;
  const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж'];

  function gradeFor(p) { return p >= 90 ? 5 : p >= 70 ? 4 : p >= 50 ? 3 : 2; }

  /* ---------- Один вопрос ---------- */
  function question(topic, q, n, total, onAnswered, opts) {
    opts = opts || {};
    const box = el('div', 'q card');
    const sub = topic.subtopics[q.sub] || { title: '' };
    const hint = { one: 'один ответ', many: 'все верные', match: 'соответствие', term: 'впиши термин' }[q.type];
    box.appendChild(el('div', 'q-head', '<span>' + (opts.label ? esc(opts.label) : (total ? 'q' + n + '/' + total : 'q' + n)) + '</span><span class="q-hint">' + hint + '</span>'));
    box.appendChild(el('div', 'q-text', esc(q.q)));
    const body = el('div', 'q-body');
    box.appendChild(body);
    const actions = el('div', 'q-actions');
    const check = UI.button('btn btn-primary', 'Проверить');
    check.disabled = true;
    actions.appendChild(check);
    box.appendChild(actions);

    let result;

    if (q.type === 'one' || q.type === 'many') {
      const multi = q.type === 'many';
      const name = 'q' + Math.random().toString(36).slice(2);
      const list = el('div', 'options');
      // Варианты перемешиваются, order[i] — номер варианта в данных
      const order = UI.shuffle(q.options.map(function (_, i) { return i; }));
      const answer = multi ? q.answer.map(function (a) { return order.indexOf(a); }) : order.indexOf(q.answer);
      order.forEach(function (oi, i) {
        const label = el('label', 'option');
        const input = document.createElement('input');
        input.type = multi ? 'checkbox' : 'radio';
        input.name = name;
        label.appendChild(input);
        label.appendChild(el('span', 'opt-num', (i + 1) + ')'));
        label.appendChild(el('span', null, esc(q.options[oi])));
        input.addEventListener('change', function () {
          list.querySelectorAll('.option').forEach(function (o) { o.classList.toggle('picked', o.querySelector('input').checked); });
          check.disabled = !list.querySelector('input:checked');
        });
        list.appendChild(label);
      });
      body.appendChild(list);
      result = function () {
        const right = multi ? answer.slice() : [answer];
        const chosen = [];
        list.querySelectorAll('input').forEach(function (inp, i) { inp.disabled = true; if (inp.checked) chosen.push(i); });
        list.querySelectorAll('.option').forEach(function (o, i) {
          const r = right.indexOf(i) !== -1, c = chosen.indexOf(i) !== -1;
          if (c && r) o.classList.add('right'); else if (c) o.classList.add('wrong'); else if (r) o.classList.add('missed');
        });
        const ok = chosen.length === right.length && chosen.every(function (c) { return right.indexOf(c) !== -1; });
        return { ok, right: (multi ? 'верные — ' : 'верный — ') + right.map(function (r) { return r + 1; }).sort().join(', ') };
      };
    }

    if (q.type === 'match') {
      const grid = el('div', 'match');
      const selects = [];
      const leftOrder = UI.shuffle(q.left.map(function (_, i) { return i; }));
      const leftAnswer = leftOrder.map(function (i) { return q.answer[i]; });
      leftOrder.forEach(function (li, i) {
        grid.appendChild(el('div', 'match-left', '<b>' + LETTERS[i] + ')</b> ' + esc(q.left[li])));
        const sel = document.createElement('select');
        sel.appendChild(new Option('— выбери —', ''));
        q.right.forEach(function (r, ri) { sel.appendChild(new Option((ri + 1) + ') ' + r, String(ri))); });
        sel.addEventListener('change', function () { check.disabled = selects.some(function (s) { return s.value === ''; }); });
        selects.push(sel);
        grid.appendChild(sel);
      });
      body.appendChild(grid);
      result = function () {
        let all = true;
        const lefts = grid.querySelectorAll('.match-left');
        selects.forEach(function (sel, i) {
          sel.disabled = true;
          const ok = +sel.value === leftAnswer[i];
          if (!ok) all = false;
          lefts[i].classList.add(ok ? 'right' : 'wrong');
          if (!ok) sel.insertAdjacentElement('afterend', el('div', 'match-fix', 'верно: ' + esc(q.right[leftAnswer[i]])));
        });
        return { ok: all, right: 'последовательность — ' + leftAnswer.map(function (a) { return a + 1; }).join('') };
      };
    }

    if (q.type === 'term') {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'term-input';
      input.placeholder = 'термин';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.addEventListener('input', function () { check.disabled = !input.value.trim(); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !check.disabled) check.click(); });
      body.appendChild(input);
      result = function () {
        input.disabled = true;
        const ok = Text.termMatches(input.value, q.answer);
        input.classList.add(ok ? 'right' : 'wrong');
        return { ok, right: 'термин — «' + q.answer[0] + '»' };
      };
    }

    check.addEventListener('click', function () {
      if (check.disabled) return;
      const res = result();
      box.classList.add('locked');
      actions.remove();
      const fb = el('div', 'feedback ' + (res.ok ? 'ok' : 'bad'));
      fb.innerHTML = '<span class="fb-title">' + (res.ok ? 'верно' : 'неверно: ' + esc(res.right)) + '</span>' + esc(q.explain || '') +
        (opts.noLink ? '' : ' <a href="#/t/' + topic.id + '/notes" class="fb-link">→ ' + esc(sub.title) + '</a>');
      box.appendChild(fb);
      onAnswered(res.ok, box);
    });
    return box;
  }

  /* ---------- Вариант теста ---------- */
  const MODE_NOTE = {
    first: 'Вариант 1 — первое изучение. Для галочки нужны «5», прочитанная шпора и 25 минут практики.',
    retake: 'Пересдача повтора — вариант, который давно не попадался.',
    practice: 'Тренировка: результат не меняет расписание повторов.'
  };

  function test(box, topic, onFinish) {
    box.innerHTML = '';
    const pick = Progress.pickVariant(topic.id);
    const variant = topic.tests && topic.tests[pick.index];
    const head = el('div', 'block-head', '<h3>test · вариант ' + (pick.index + 1) + '</h3>');
    box.appendChild(head);
    const note = pick.mode === 'review' ? 'Повтор: вариант ' + (pick.index + 1) + ', нужна «5».' : MODE_NOTE[pick.mode];
    box.appendChild(el('p', 'muted', esc(note) + ' ' + (variant ? variant.length : 0) + ' вопросов, порядок перемешан.'));
    if (!variant || !variant.length) { box.appendChild(el('p', 'muted', 'Для этой темы теста нет.')); return; }

    // Вопросы по одному: после ответа — разбор и кнопка «Дальше»,
    // сам тест никуда не перелистывает
    const questions = UI.shuffle(variant);
    let answered = 0, correct = 0;
    const meter = el('div', 'meter', '<span></span>');
    const count = el('div', 'meter-label');
    box.appendChild(meter);
    box.appendChild(count);
    function paint() {
      meter.firstChild.style.width = Math.round(answered / questions.length * 100) + '%';
      count.textContent = answered + '/' + questions.length + ' · верно ' + correct;
    }
    paint();
    const slot = el('div', 'q-list');
    box.appendChild(slot);
    function show(i) {
      slot.innerHTML = '';
      slot.appendChild(question(topic, questions[i], i + 1, questions.length, function (ok, node) {
        answered++;
        if (ok) correct++;
        paint();
        const row = el('div', 'q-actions');
        const last = answered === questions.length;
        const more = UI.button('btn btn-primary', last ? 'Итог →' : 'Дальше →', function () {
          if (last) { slot.innerHTML = ''; finish(); } else show(i + 1);
          box.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        row.appendChild(more);
        node.appendChild(row);
        UI.nextOnEnter(more);
      }));
    }
    show(0);

    function finish() {
      const percent = Math.round(correct / questions.length * 100);
      const grade = gradeFor(percent);
      const outcome = Progress.recordTest(topic.id, pick.index, pick.mode, grade, percent);
      const res = el('div', 'result card g' + grade);
      res.innerHTML = '<div class="grade">' + grade + '</div><div><b>' + correct + ' из ' + questions.length + ' (' + percent + '%)</b><p>' + esc(outcomeText(outcome, topic.id)) + '</p></div>';
      res.appendChild(UI.button('btn', 'Пройти ещё раз', function () { test(box, topic, onFinish); box.scrollIntoView({ behavior: 'smooth' }); }));
      box.appendChild(res);
      res.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (onFinish) onFinish(outcome, grade);
    }
  }

  function outcomeText(o, id) {
    const d = o.next ? Progress.human(o.next) : '';
    const practiceLeft = Progress.missing(id).indexOf('practice') !== -1;
    switch (o.kind) {
      case 'studied': return 'Тема изучена. Первый повтор — ' + d + '.';
      case 'need-theory': return 'Тест сдан на «5». Дочитай шпору до конца' + (practiceLeft ? ' и набери 25 минут практики' : '') + ' — и тема получит галочку.';
      case 'need-practice': return 'Тест сдан на «5». Осталось набрать 25 минут практики.';
      case 'first-failed': return 'Для галочки нужна «5». Перечитай подтемы, где были ошибки, и попробуй снова.';
      case 'review1-ok': return 'Первый повтор засчитан. Второй — ' + d + '.';
      case 'fixed': return 'Тема закреплена: оба повтора пройдены.';
      case 'mock-ok': return 'Повтор засчитан.';
      case 'review-failed': return 'Повтор не засчитан — нужна «5». Пересдача ' + d + ', вариант будет другой.';
      case 'practice': return 'Тренировка: расписание повторов не изменилось.';
      default: return '';
    }
  }

  /* ---------- Бесконечная тренировка ---------- */
  function endless(box, topic) {
    box.innerHTML = '';
    const pool = [];
    (topic.tests || []).forEach(function (v) { (v || []).forEach(function (q) { pool.push(q); }); });
    if (!pool.length) { box.appendChild(el('p', 'muted', 'Для этой темы вопросов нет.')); return; }
    let queue = UI.shuffle(pool), pos = 0, answered = 0, correct = 0;
    const count = el('div', 'meter-label', '0 ответов');
    const slot = el('div', 'q-list');
    box.appendChild(count);
    box.appendChild(slot);
    function next() {
      if (pos >= queue.length) { queue = UI.shuffle(pool); pos = 0; }
      const q = queue[pos++];
      slot.innerHTML = '';
      const card = question(topic, q, answered + 1, 0, function (ok, node) {
        answered++;
        if (ok) correct++;
        count.textContent = answered + ' ' + UI.plural(answered, ['ответ', 'ответа', 'ответов']) + ' · верно ' + correct;
        const row = el('div', 'q-actions');
        const more = UI.button('btn btn-primary', 'Дальше →', function () { next(); slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
        row.appendChild(more);
        node.appendChild(row);
        UI.nextOnEnter(more);
      });
      slot.appendChild(card);
    }
    next();
  }

  // Случайный вопрос темы — для опроса каждые 15 минут
  function randomQuestion(topic) {
    const pool = [];
    (topic.tests || []).forEach(function (v) { (v || []).forEach(function (q) { pool.push(q); }); });
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  window.Quiz = { question, test, endless, gradeFor, randomQuestion };
})();
