/* =========================================================
   Опрос каждые 15 минут практики (событие 'quiz-due' из js/timer.js).
   По желанию: уведомление «Пройти / Позже». 10 вопросов вперемешку
   из закреплённых тем обоих предметов (оба повтора сданы):
   обществознание — вопросы тестов, математика — задачи банка с автопроверкой.
   Пока открыт опрос, таймер практики стоит. Расписание повторов опрос не меняет.
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;
  const SIZE = 10;

  function fixedTopics() {
    return Subjects.all().filter(function (tp) { return Progress.status(tp.id).code === 'fixed'; });
  }

  // Задачи математики с автопроверкой (без самопроверки и вариантов №1–5)
  function mathUnits(topic) {
    return Bank.units(topic).filter(function (u) { return u.kind === 'task' && Bank.isNumeric(u.task); });
  }

  function build() {
    const topics = fixedTopics().filter(function (tp) {
      return Subjects.of(tp.id) === 'social' ? !!Quiz.randomQuestion(tp) : mathUnits(tp).length > 0;
    });
    if (!topics.length) return [];
    const items = [];
    for (let i = 0; i < SIZE; i++) {
      const tp = topics[Math.floor(Math.random() * topics.length)];
      if (Subjects.of(tp.id) === 'social') items.push({ topic: tp, q: Quiz.randomQuestion(tp) });
      else { const list = mathUnits(tp); items.push({ topic: tp, u: list[Math.floor(Math.random() * list.length)] }); }
    }
    return items;
  }

  function open() {
    const items = build();
    if (!items.length) { UI.toast('Закреплённых тем пока нет — опрос появится после вторых повторов.'); return; }
    Timer.pause(true);
    const overlay = el('div', 'overlay');
    const box = el('div', 'quiz-modal card');
    overlay.appendChild(box);
    const head = el('div', 'block-head');
    const title = el('h3', null, 'pop-quiz');
    const counter = el('span', 'muted');
    head.appendChild(title);
    head.appendChild(counter);
    head.appendChild(UI.button('link-btn', 'закрыть ✕', close));
    box.appendChild(head);
    box.appendChild(el('p', 'muted', 'Закреплённые темы обоих предметов. Расписание повторов не меняется.'));
    const slot = el('div', 'q-list');
    box.appendChild(slot);
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');

    let i = 0, correct = 0;
    function paint() { counter.textContent = Math.min(i + 1, items.length) + '/' + items.length + ' · верно ' + correct; }

    function next() {
      slot.innerHTML = '';
      if (i >= items.length) return finish();
      paint();
      const it = items[i];
      const label = Subjects.get(Subjects.of(it.topic.id)).dir + ' / ' + it.topic.title;
      let card;
      if (it.q) {
        card = Quiz.question(it.topic, it.q, i + 1, items.length, function (ok, node) {
          if (ok) correct++;
          paint();
          const row = el('div', 'q-actions');
          row.appendChild(UI.button('btn btn-primary', 'Дальше →', function () { i++; next(); }));
          node.appendChild(row);
        }, { label, noLink: true });
      } else {
        card = Practice.unit(it.u, { review: true, label, onResult: function (ok) { if (ok) correct++; paint(); }, onNext: function () { i++; next(); } });
      }
      slot.appendChild(card);
      Text.render(card);
      box.scrollTop = 0;
    }

    function finish() {
      counter.textContent = '';
      const res = el('div', 'result card ' + (correct >= 8 ? 'g5' : correct >= 5 ? 'g4' : 'g2'),
        '<div class="grade">' + correct + '</div><div><b>' + correct + ' из ' + items.length + '</b><p>' +
        (correct >= 8 ? 'Закреплённое держится. Можно возвращаться к практике.' : 'Часть забылась — загляни в шпору тем, где были ошибки.') + '</p></div>');
      res.appendChild(UI.button('btn btn-primary', 'К практике', close));
      slot.appendChild(res);
    }

    function close() {
      overlay.remove();
      document.body.classList.remove('modal-open');
      Timer.pause(false);
    }
    next();
  }

  window.addEventListener('quiz-due', function () {
    if (document.querySelector('.quiz-modal')) return;
    if (!fixedTopics().length) {
      UI.toast('15 минут практики позади. Опрос по закреплённым темам появится, когда темы пройдут оба повтора.');
      return;
    }
    UI.toast('15 минут практики. Опрос по закреплённым темам — 10 вопросов?', {
      actions: [{ label: 'Пройти', run: open }, { label: 'Позже', run: function () {} }]
    });
  });

  window.PopQuiz = { open, fixedTopics };
})();
