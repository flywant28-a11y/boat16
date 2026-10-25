/* =========================================================
   Таймер практики. Время идёт, только пока окно видно и есть активность:
   после 3 минут без нажатий, ввода и прокрутки таймер встаёт на паузу.
   Минуты копятся по теме (Progress.addPractice) — их можно добирать
   за несколько заходов. Цель: обществознание 25 мин, математика 60 мин.
   Каждые 15 активных минут практики (по всем темам за заход) —
   событие 'quiz-due': приложение предлагает опрос по закреплённым темам.
   ========================================================= */
(function () {
  'use strict';

  const IDLE_MS = 3 * 60 * 1000;
  const QUIZ_EVERY = 15 * 60;
  const FLUSH_EVERY = 5;

  let active = null;        // { id, bar, interval, pending, sec, goal }
  let lastActivity = Date.now();
  let sinceQuiz = 0;        // активные секунды с последнего предложения опроса
  let paused = false;       // открыт опрос — время практики не идёт

  ['pointerdown', 'keydown', 'input', 'wheel', 'touchstart', 'scroll'].forEach(function (ev) {
    window.addEventListener(ev, function () {
      const wasIdle = Date.now() - lastActivity >= IDLE_MS;
      lastActivity = Date.now();
      if (wasIdle && active) paint();
    }, { passive: true, capture: true });
  });

  function running() {
    return !!active && !paused && document.visibilityState === 'visible' && Date.now() - lastActivity < IDLE_MS;
  }

  function paint() {
    if (!active) return;
    const pct = Math.min(100, active.sec / active.goal * 100);
    const run = running();
    active.bar.classList.toggle('idle', !run);
    active.bar.querySelector('.pt-time').textContent = UI.mmss(active.sec);
    active.bar.querySelector('.pt-fill').style.width = pct + '%';
    active.bar.querySelector('.pt-state').textContent = run ? 'running' : (paused ? 'quiz' : 'paused');
    const left = Math.max(0, active.goal - active.sec);
    active.bar.querySelector('.pt-left').textContent = left ? Math.ceil(left / 60) + ' min to goal' : 'goal reached';
  }

  function flush() {
    if (!active || !active.pending) return;
    const res = Progress.addPractice(active.id, active.pending);
    active.pending = 0;
    if (res.goalReached) {
      UI.toast(res.closed ? 'Practice goal reached — topic studied. First review in 3 days.' : 'Practice goal reached. Finish the other steps of the topic.', { kind: 'ok' });
      window.dispatchEvent(new CustomEvent('practice-goal', { detail: { id: active.id, closed: res.closed } }));
    }
  }

  function tick() {
    if (!active) return;
    if (!document.body.contains(active.bar)) { stop(); return; }
    if (running()) {
      active.sec++;
      active.pending++;
      sinceQuiz++;
      if (active.pending >= FLUSH_EVERY) flush();
      if (sinceQuiz >= QUIZ_EVERY) {
        sinceQuiz = 0;
        window.dispatchEvent(new CustomEvent('quiz-due'));
      }
    }
    paint();
  }

  // Полоса таймера над практикой
  function start(id) {
    stop();
    const t = Progress.topic(id);
    const bar = UI.el('div', 'ptimer');
    bar.innerHTML =
      '<span class="pt-label">practice</span>' +
      '<span class="pt-time">00:00</span><span class="pt-goal">/ ' + Subjects.get(Subjects.of(id)).goalMin + ':00</span>' +
      '<span class="pt-bar"><span class="pt-fill"></span></span>' +
      '<span class="pt-state">running</span><span class="pt-left"></span>';
    active = { id, bar, interval: setInterval(tick, 1000), pending: 0, sec: t.practiceSec || 0, goal: Subjects.goalSec(id) };
    lastActivity = Date.now();
    paint();
    return bar;
  }

  function stop() {
    if (!active) return;
    flush();
    clearInterval(active.interval);
    active = null;
  }

  function pause(on) { paused = !!on; paint(); }

  document.addEventListener('visibilitychange', function () { if (document.visibilityState !== 'visible') flush(); paint(); });
  window.addEventListener('pagehide', flush);

  window.Timer = { start, stop, pause, running, flush };
})();
