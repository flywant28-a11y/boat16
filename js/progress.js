/* =========================================================
   Предметы и прогресс с интервальными повторами (логика старого сайта).

   Subjects: обществознание и математика. У тем математики id начинается с «m-».

   Жизненный цикл темы (поле stage):
     0 — не изучена. Чтобы закрыть тему, нужно:
           обществознание — прочитать теорию, сдать вариант 1 теста на «5»
                            и набрать 25 минут практики;
           математика     — прочитать теорию и набрать 60 минут практики
         (порядок любой);
     1 — изучена: первый повтор через 3 дня
         (обществознание — вариант 2 теста, математика — 10 новых задач);
     2 — первый повтор сдан: второй повтор через 7 дней;
     3 — закреплена: оба повтора сданы.
   Повтор засчитан: обществознание — «5», математика — 8 верных из 10.
   Неудачный повтор назначается заново через 3 дня.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Предметы ---------- */
  const SUBJECTS = {
    social: { id: 'social', name: 'Social studies', dir: 'social', topics: window.SOCIAL_TOPICS || [], goalMin: 25 },
    math: { id: 'math', name: 'Math', dir: 'math', topics: window.MATH_TOPICS || [], goalMin: 60 }
  };
  const ORDER = ['social', 'math'];

  function of(topicId) { return /^m-/.test(String(topicId)) ? 'math' : 'social'; }
  function getSubject(id) { return SUBJECTS[id] || SUBJECTS.social; }

  function find(topicId) {
    const s = of(topicId);
    const list = SUBJECTS[s].topics;
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === topicId) return { topic: list[i], index: i, subject: s, list: list };
    }
    return null;
  }

  function goalSec(topicId) { return SUBJECTS[of(topicId)].goalMin * 60; }

  window.Subjects = {
    ORDER, get: getSubject, of, find, goalSec,
    all: function () { return SUBJECTS.social.topics.concat(SUBJECTS.math.topics); }
  };

  /* ---------- Даты (локальные, ГГГГ-ММ-ДД) ---------- */
  const FIRST_INTERVAL = 3, SECOND_INTERVAL = 7, RETRY_INTERVAL = 3;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(key) { const p = key.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { return toKey(new Date()); }
  function addDays(key, days) { const d = fromKey(key); d.setDate(d.getDate() + days); return toKey(d); }
  function diffDays(a, b) { return Math.round((fromKey(b) - fromKey(a)) / 86400000); }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function human(key) {
    if (!key) return '';
    const delta = diffDays(today(), key);
    if (delta === 0) return 'today';
    if (delta === 1) return 'tomorrow';
    if (delta === -1) return 'yesterday';
    const d = fromKey(key);
    return MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  /* ---------- Хранилище ---------- */
  let data;
  function load() {
    data = Store.get('progress', null);
    if (!data || typeof data !== 'object' || !data.topics) data = { version: 2, topics: {} };
    if (!data.activity || typeof data.activity !== 'object') data.activity = {};
    if (!data.daySec || typeof data.daySec !== 'object') data.daySec = {};
  }
  load();
  function save() { Store.set('progress', data); }

  function blank() {
    return {
      theoryRead: false, firstPassed: false, stage: 0, studiedOn: null, nextReview: null,
      retake: false, variantUsed: [0, 0, 0], attempts: [], practiceSec: 0, mockReview: null
    };
  }

  function topic(id) {
    if (!data.topics[id]) data.topics[id] = blank();
    const t = data.topics[id], b = blank();
    for (const k in b) if (!(k in t)) t[k] = b[k];
    return t;
  }
  function peek(id) { return data.topics[id] || null; }
  function markActive() { data.activity[today()] = true; }

  /* ---------- Статус темы для календаря ----------
     code: new | studied | today | overdue | fixed */
  function mockDue(t) { return !!(t && t.mockReview && diffDays(today(), t.mockReview) <= 0); }

  function status(id) {
    const t = peek(id);
    const mock = mockDue(t);
    if (!t || t.stage === 0) {
      if (mock) return { code: 'today', label: 'after mock exam: study the topic', date: t.mockReview, mock: true };
      const started = t && (t.theoryRead || t.attempts.length || t.practiceSec > 0);
      return { code: 'new', label: started ? (t.theoryRead ? 'notes read' : 'started') : 'not started', date: null, started: !!started };
    }
    if (mock) {
      const late = diffDays(today(), t.mockReview) < 0;
      return { code: late ? 'overdue' : 'today', label: 'review after mock exam', date: t.mockReview, mock: true };
    }
    if (t.stage >= 3) return { code: 'fixed', label: 'mastered', date: null };
    const delta = diffDays(today(), t.nextReview);
    const which = t.stage === 1 ? 'first' : 'second';
    if (delta < 0) return { code: 'overdue', label: which + ' review overdue', date: t.nextReview };
    if (delta === 0) return { code: 'today', label: which + ' review today', date: t.nextReview };
    return { code: 'studied', label: which + ' review ' + human(t.nextReview), date: t.nextReview };
  }

  function isDue(id) { const s = status(id).code; return s === 'today' || s === 'overdue'; }
  function reviewDue(id) { const t = peek(id); return !!(t && t.stage >= 1 && isDue(id)); }

  /* ---------- Какой вариант теста выдать ---------- */
  function oldestVariant(t) {
    let best = 0;
    for (let i = 1; i < 3; i++) if (t.variantUsed[i] < t.variantUsed[best]) best = i;
    return best;
  }

  // mode: first | review | retake | practice
  function pickVariant(id) {
    const t = topic(id);
    if (t.stage === 0) return { index: 0, mode: 'first' };
    if (isDue(id)) {
      if (t.retake) return { index: oldestVariant(t), mode: 'retake' };
      if (t.stage >= 3) return { index: oldestVariant(t), mode: 'review' };
      const planned = t.stage;
      return { index: t.variantUsed[planned] ? oldestVariant(t) : planned, mode: 'review' };
    }
    return { index: oldestVariant(t), mode: 'practice' };
  }

  /* ---------- Закрытие темы ---------- */
  function practiceDone(id, t) { return (t.practiceSec || 0) >= goalSec(id); }

  // Что ещё осталось до галочки: ['theory', 'test', 'practice']
  function missing(id) {
    const t = topic(id), list = [];
    if (t.stage >= 1) return list;
    if (!t.theoryRead) list.push('theory');
    if (of(id) === 'social' && !t.firstPassed) list.push('test');
    if (!practiceDone(id, t)) list.push('practice');
    return list;
  }

  function tryClose(id) {
    const t = topic(id);
    if (t.stage !== 0 || missing(id).length) return false;
    t.stage = 1;
    t.studiedOn = today();
    t.nextReview = addDays(today(), FIRST_INTERVAL);
    t.retake = false;
    t.mockReview = null;
    save();
    window.dispatchEvent(new CustomEvent('topic-closed', { detail: { id } }));
    return true;
  }

  function markTheoryRead(id) {
    const t = topic(id);
    if (t.theoryRead) return false;
    t.theoryRead = true;
    save();
    return tryClose(id);
  }

  function addPractice(id, sec) {
    const t = topic(id);
    const goal = goalSec(id), before = t.practiceSec || 0;
    t.practiceSec = before + sec;
    data.daySec[today()] = (data.daySec[today()] || 0) + sec;
    markActive();
    save();
    const reached = before < goal && t.practiceSec >= goal;
    return { total: t.practiceSec, goalReached: reached, closed: reached ? tryClose(id) : false };
  }

  function recordReview(id, passed) {
    const t = topic(id);
    const regularDue = t.stage >= 1 && t.stage < 3 && t.nextReview && diffDays(today(), t.nextReview) <= 0;
    const mock = mockDue(t);
    let outcome;
    if (passed) {
      if (mock) t.mockReview = null;
      t.retake = false;
      if (regularDue || (!mock && t.stage >= 1 && t.stage < 3)) {
        if (t.stage === 1) {
          t.stage = 2;
          t.nextReview = addDays(today(), SECOND_INTERVAL);
          outcome = { kind: 'review1-ok', next: t.nextReview };
        } else {
          t.stage = 3;
          t.nextReview = null;
          outcome = { kind: 'fixed', next: null };
        }
      } else {
        outcome = { kind: 'mock-ok', next: t.nextReview };
      }
    } else {
      if (mock) t.mockReview = addDays(today(), RETRY_INTERVAL);
      if (regularDue) { t.retake = true; t.nextReview = addDays(today(), RETRY_INTERVAL); }
      outcome = { kind: 'review-failed', next: regularDue ? t.nextReview : t.mockReview };
    }
    save();
    if (outcome.kind === 'fixed') window.dispatchEvent(new CustomEvent('topic-fixed', { detail: { id } }));
    return outcome;
  }

  function recordTest(id, variantIndex, mode, grade, percent) {
    const t = topic(id);
    t.variantUsed[variantIndex] = Date.now();
    t.attempts.push({ date: today(), variant: variantIndex + 1, mode, grade, percent });
    if (t.attempts.length > 60) t.attempts = t.attempts.slice(-60);
    markActive();
    let outcome = { kind: 'none', next: null };
    if (mode === 'first') {
      if (grade === 5) {
        t.firstPassed = true;
        save();
        if (tryClose(id)) outcome = { kind: 'studied', next: t.nextReview };
        else if (!t.theoryRead) outcome = { kind: 'need-theory', next: null };
        else outcome = { kind: 'need-practice', next: null };
      } else {
        outcome = { kind: 'first-failed', next: null };
      }
    } else if (mode === 'review' || mode === 'retake') {
      outcome = recordReview(id, grade === 5);
    } else {
      outcome = { kind: 'practice', next: t.nextReview };
    }
    save();
    return outcome;
  }

  function recordMathReview(id, correct, total, keys) {
    const t = topic(id);
    t.attempts.push({ date: today(), mode: 'review', correct, total, keys: keys || [] });
    if (t.attempts.length > 60) t.attempts = t.attempts.slice(-60);
    markActive();
    return recordReview(id, correct >= 8);
  }

  function resetTopic(id) { delete data.topics[id]; save(); }

  /* Процент темы: теория — 30 %, практика — 50 % пропорционально минутам,
     первый повтор — 10 %, второй — 10 %. */
  function percent(id) {
    const t = peek(id);
    if (!t) return 0;
    let p = t.theoryRead || t.stage >= 1 ? 30 : 0;
    p += t.stage >= 1 ? 50 : 50 * Math.min(1, (t.practiceSec || 0) / goalSec(id));
    if (t.stage >= 2) p += 10;
    if (t.stage >= 3) p += 10;
    return p;
  }

  function dueList(topics) { return topics.filter(function (tp) { return isDue(tp.id); }); }

  function nextNew(topics) {
    for (let i = 0; i < topics.length; i++) if (status(topics[i].id).code === 'new') return topics[i];
    return null;
  }

  function activeDays() {
    const days = {};
    for (const d in data.activity) days[d] = true;
    for (const id in data.topics) (data.topics[id].attempts || []).forEach(function (a) { days[a.date] = true; });
    return days;
  }

  function streak() {
    const days = activeDays();
    let day = today();
    if (!days[day]) day = addDays(day, -1);
    let n = 0;
    while (days[day]) { n++; day = addDays(day, -1); }
    return n;
  }

  function daySec(key) { return data.daySec[key || today()] || 0; }

  /* ---------- Экспорт / импорт ----------
     Формат совместим со старым сайтом (oge-social, version 2–3):
     прогресс тем + extra['math-solved'] и extra.reported. Остальное из старого
     файла (XP, сезон, кругосветка и т. п.) игнорируется. */
  const EXTRA_KEYS = ['math-solved', 'reported'];

  function exportJSON() {
    const extra = {};
    EXTRA_KEYS.forEach(function (k) { const v = Store.get(k, undefined); if (v !== undefined) extra[k] = v; });
    return JSON.stringify({ app: 'boat16', version: 1, exportedAt: new Date().toISOString(), progress: data, extra }, null, 2);
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    const incoming = parsed && parsed.progress ? parsed.progress : parsed;
    if (!incoming || typeof incoming !== 'object' || typeof incoming.topics !== 'object') throw new Error('No progress found in this file');
    data = { version: 2, topics: incoming.topics, activity: incoming.activity || {}, daySec: incoming.daySec || {} };
    save();
    if (parsed.extra && typeof parsed.extra === 'object') {
      EXTRA_KEYS.forEach(function (k) { if (k in parsed.extra) Store.set(k, parsed.extra[k]); });
    }
    return Object.keys(data.topics).length;
  }

  function resetAll() {
    data = { version: 2, topics: {}, activity: {}, daySec: {} };
    save();
    EXTRA_KEYS.forEach(Store.remove);
  }

  window.Progress = {
    today, addDays, diffDays, human,
    topic, peek, status, isDue, reviewDue, pickVariant,
    markTheoryRead, recordTest, addPractice, recordMathReview,
    missing, tryClose, percent, resetTopic, dueList, nextNew, activeDays, streak, daySec,
    markActive: function () { markActive(); save(); },
    exportJSON, importJSON, resetAll
  };
})();
