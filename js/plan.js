/* =========================================================
   План до ОГЭ и дни календаря.
   Даты экзаменов — Store 'exams' { social, math } (ГГГГ-ММ-ДД). Пока их нет,
   считаем от примерной даты (расписание 2027 ещё не утверждено).
   Новые темы раскладываются равномерно с завтрашнего дня до «финиша» —
   за 21 день до экзамена, чтобы успеть оба повтора (3 + 7 дней) и запас.
   План всегда считается от сегодняшнего дня: пропущенный день сдвигает
   оставшиеся темы вперёд, отдельно ничего не хранится.
   Plan.day(дата) → {
     minutes, closed:[id], passed:[id],      — прошлое и сегодня: что сделано;
     reviews:[id], overdue:[id],             — сегодня и будущее: назначенные повторы;
     planned:[id], exam:[предмет]            — будущее: новые темы по плану, экзамены }
   ========================================================= */
(function () {
  'use strict';

  const GUESS = '2027-06-01';   // примерно: начало основного периода
  const BUFFER = 21;            // дней до экзамена на повторы
  const PACE_DAYS = 14;         // окно для «твой темп»

  function exams() {
    const e = Store.get('exams', {}) || {};
    return {
      social: e.social || GUESS, math: e.math || GUESS,
      guess: { social: !e.social, math: !e.math }
    };
  }

  function setExam(subj, date) {
    const e = Store.get('exams', {}) || {};
    if (date) e[subj] = date; else delete e[subj];
    Store.set('exams', e);
    cache = null;
  }

  /* ---------- План новых тем ---------- */
  let cache = null;

  // Новые темы предмета по порядку шпоры: начатые — первыми
  function remaining(subj) {
    const list = Subjects.get(subj).topics.filter(function (tp) { return Progress.status(tp.id).code === 'new'; });
    return list.filter(function (tp) { return Progress.status(tp.id).started; })
      .concat(list.filter(function (tp) { return !Progress.status(tp.id).started; }));
  }

  function build() {
    const today = Progress.today();
    const ex = exams();
    const plan = {}, info = {};
    Subjects.ORDER.forEach(function (s) {
      const left = remaining(s);
      const finish = Progress.addDays(ex[s], -BUFFER);
      const start = Progress.addDays(today, 1);
      const days = Math.max(1, Progress.diffDays(start, finish) + 1);
      left.forEach(function (tp, i) {
        const d = Progress.addDays(start, Math.min(days - 1, Math.floor(i * days / left.length)));
        (plan[d] = plan[d] || []).push(tp.id);
      });
      // Темп: сколько тем изучено за последние 14 дней
      let recent = 0;
      Subjects.get(s).topics.forEach(function (tp) {
        const t = Progress.peek(tp.id);
        if (t && t.studiedOn && Progress.diffDays(t.studiedOn, today) < PACE_DAYS) recent++;
      });
      const need = left.length / days;
      const have = recent / PACE_DAYS;
      info[s] = {
        left: left.length, days, finish, exam: ex[s], guess: ex.guess[s],
        need, have,
        // Когда закончишь в своём темпе (если темп нулевой — неизвестно)
        eta: have > 0 ? Progress.addDays(today, Math.ceil(left.length / have)) : null
      };
    });
    cache = { day: today, plan, info };
    return cache;
  }

  function current() { return cache && cache.day === Progress.today() ? cache : build(); }

  /* ---------- День календаря ---------- */
  function day(key) {
    const today = Progress.today();
    const delta = Progress.diffDays(today, key);
    const out = { key, minutes: 0, closed: [], passed: [], reviews: [], overdue: [], planned: [], exam: [] };

    if (delta <= 0) {
      out.minutes = Math.round(Progress.daySec(key) / 60);
      Subjects.all().forEach(function (tp) {
        const t = Progress.peek(tp.id);
        if (!t) return;
        if (t.studiedOn === key) out.closed.push(tp.id);
        const ok = (t.attempts || []).some(function (a) {
          return a.date === key && a.mode === 'review' && (a.grade === 5 || (a.correct !== undefined && a.correct >= 8));
        });
        if (ok) out.passed.push(tp.id);
      });
    }
    if (delta >= 0) {
      Subjects.all().forEach(function (tp) {
        const st = Progress.status(tp.id);
        if (!st.date || st.code === 'fixed' || (st.code === 'new' && !st.mock)) return;
        const late = Progress.diffDays(st.date, today) > 0;
        if (late) { if (delta === 0) out.overdue.push(tp.id); }
        else if (st.date === key) out.reviews.push(tp.id);
      });
      if (delta > 0) out.planned = (current().plan[key] || []).slice();
    }
    const ex = exams();
    Subjects.ORDER.forEach(function (s) { if (ex[s] === key) out.exam.push(s); });
    return out;
  }

  function info() { return current().info; }

  window.Plan = { exams, setExam, day, info, refresh: function () { cache = null; } };
  window.addEventListener('topic-closed', function () { cache = null; });
})();
