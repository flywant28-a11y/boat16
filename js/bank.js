/* =========================================================
   Банк задач математики (window.MATH_BANK из data/math-bank.js).

   Банк type:'tasks'    — отдельные задачи { id, g, img, a, check, item?, aimg? };
   банк type:'variants' — варианты №1–5 { n, images:[...], questions:[{ id, a, check }] }.
   check: 'auto'   — сравнить ввод с ответом a;
          'digits' — набор цифр в любом порядке (№19: «13» = «31»);
          'self'   — самопроверка: показать ответ, затем «Решил верно / Ошибся».

   Статистика: Store 'math-solved'[банк:id] = { ok, tries, last }.
   Задачи с ошибкой: Store 'reported' — такие задачи не выдаются.
   ========================================================= */
(function () {
  'use strict';

  const BANK = window.MATH_BANK || {};
  let solved = Store.get('math-solved', {}) || {};
  let reported = Store.get('reported', []);
  if (!Array.isArray(reported)) reported = [];

  function reload() {
    solved = Store.get('math-solved', {}) || {};
    reported = Store.get('reported', []) || [];
  }

  /* ---------- Проверка ответа ---------- */
  function normalize(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/\s+/g, '').replace(/\./g, ',').replace(/[−–—]/g, '-').replace(/°/g, '').toLowerCase();
  }
  function toNumber(s) { return /^-?\d+(,\d+)?$|^-?,\d+$/.test(s) ? parseFloat(s.replace(',', '.')) : NaN; }
  function isNumeric(task) { return task.check === 'auto' || task.check === 'digits'; }

  // 'ok' | 'bad' | 'sign' (ввод ровно противоположен ответу: в банке мог потеряться минус)
  function check(task, input) {
    const a = normalize(task.a), b = normalize(input);
    if (!b) return null;
    if (task.check === 'digits') {
      const da = a.replace(/\D/g, '').split('').sort().join('');
      const db = b.replace(/\D/g, '').split('').sort().join('');
      return da && da === db ? 'ok' : 'bad';
    }
    if (a === b) return 'ok';
    const na = toNumber(a), nb = toNumber(b);
    if (!isNaN(na) && !isNaN(nb)) {
      if (Math.abs(na - nb) < 1e-9) return 'ok';
      if (na !== 0 && Math.abs(na + nb) < 1e-9) return 'sign';
    }
    return 'bad';
  }

  /* ---------- Статистика ---------- */
  function key(bankId, id) { return bankId + ':' + id; }
  function stat(k) { return solved[k] || null; }
  function record(k, ok) {
    const s = solved[k] || { ok: false, tries: 0, last: null };
    s.tries++;
    s.ok = !!ok;
    s.last = Progress.today();
    solved[k] = s;
    Store.set('math-solved', solved);
    Progress.markActive();
  }

  function isReported(k) { return reported.indexOf(k) !== -1; }
  function report(k) { if (!isReported(k)) { reported.push(k); Store.set('reported', reported); } }

  /* ---------- Единицы практики ----------
     Задача: { kind:'task', bank, task, key, keys:[key] }
     Вариант №1–5: { kind:'variant', bank, variant, key:'банк:v<n>', keys:[ключи вопросов] } */
  function units(topic) {
    const list = [], seen = {};
    (topic.practice || []).forEach(function (p) {
      const b = BANK[p.bank];
      if (!b) return;
      if (b.type === 'variants') {
        (b.variants || []).forEach(function (v) {
          const k = key(p.bank, 'v' + v.n);
          if (seen[k] || isReported(k)) return;
          seen[k] = true;
          list.push({ kind: 'variant', bank: p.bank, variant: v, key: k, keys: v.questions.map(function (q) { return key(p.bank, q.id); }) });
        });
        return;
      }
      (b.tasks || []).forEach(function (t) {
        if (p.groups && p.groups.indexOf(t.g) === -1) return;
        const k = key(p.bank, t.id);
        if (seen[k] || isReported(k)) return;
        seen[k] = true;
        list.push({ kind: 'task', bank: p.bank, task: t, key: k, keys: [k] });
      });
    });
    return list;
  }

  // 'new' — не решалась, 'bad' — есть ошибка, 'ok' — всё верно
  function unitState(u) {
    let any = false, bad = false;
    u.keys.forEach(function (k) { const s = solved[k]; if (!s) return; any = true; if (!s.ok) bad = true; });
    const all = u.keys.every(function (k) { return !!solved[k]; });
    if (!any || (!all && !bad)) return 'new';
    return bad ? 'bad' : 'ok';
  }

  // Очередь: сначала нерешённые, потом с ошибкой, решённые верно — в конце
  function queue(topic, exclude) {
    exclude = exclude || {};
    const groups = { 'new': [], bad: [], ok: [] };
    units(topic).forEach(function (u) { if (!exclude[u.key]) groups[unitState(u)].push(u); });
    return UI.shuffle(groups['new']).concat(UI.shuffle(groups.bad), UI.shuffle(groups.ok));
  }

  // Повтор: 10 задач, которых ещё не было; не хватает — добираем давно решавшимися
  function reviewSet(topic, size) {
    size = size || 10;
    const all = units(topic);
    const fresh = UI.shuffle(all.filter(function (u) { return unitState(u) === 'new'; }));
    const old = all.filter(function (u) { return unitState(u) !== 'new'; }).sort(function (a, b) {
      const la = (solved[a.keys[0]] || {}).last || '', lb = (solved[b.keys[0]] || {}).last || '';
      return la < lb ? -1 : la > lb ? 1 : 0;
    });
    const pick = [];
    let count = 0;
    fresh.concat(old).forEach(function (u) { if (count < size) { pick.push(u); count += u.keys.length; } });
    return pick;
  }

  function summary(topic) {
    let total = 0, ok = 0;
    units(topic).forEach(function (u) { u.keys.forEach(function (k) { total++; if (solved[k] && solved[k].ok) ok++; }); });
    return { total, ok };
  }

  function totalSolved() {
    let n = 0;
    for (const k in solved) if (solved[k].ok) n++;
    return n;
  }

  function title(bankId) { return BANK[bankId] ? BANK[bankId].title : bankId; }
  function groupText(bankId, g) { const b = BANK[bankId]; return b && b.groups ? (b.groups[String(g)] || '') : ''; }

  window.Bank = {
    normalize, check, isNumeric, key, stat, record, reload, isReported, report,
    units, unitState, queue, reviewSet, summary, totalSolved, title, groupText
  };
})();
