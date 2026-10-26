/* =========================================================
   App: рабочий стол boat16 — обои (js/themes.js), окна и статус-бар
   (js/wm.js), терминал (js/term.js) и реестр приложений-окон.
   Адрес показывает активное окно, ссылки открывают окна:
     #/                    — терминал zsh
     #/courses             — курсы: today, stats, calendar, темы
     #/t/<id>[/<вкладка>]  — тема: video · notes · review · practice
     #/calendar[/ГГГГ-ММ]  — календарь: повторы, план до ОГЭ, сделанное по дням
     #/stats               — монитор прогресса (btop)
     #/materials           — материалы Равиля из Telegram (ranger)
     #/settings            — прогресс, о сайте
     #/jaba[/файл]         — редактор языка Jaba (js/jaba.js, js/views/jaba.js)
   ========================================================= */
(function () {
  'use strict';

  function topicTitle(id) {
    const f = Subjects.find(id);
    return f ? Term.topicPath(f.topic) + ' — ' + f.topic.title : id;
  }

  // Приложения окон. size/pos — от размера рабочего стола
  const APPS = {
    term: {
      multi: true,
      title: function (arg, w) { return Term.title(w); },
      size: function (d) { return [Math.min(820, d.w * .52), Math.min(580, d.h * .64)]; },
      pos: function () { return [10, 10]; },
      render: function (box, arg, w) { Term.mount(box, arg, w); },
      onFocus: function (w) { Term.focus(w); },
      saveArg: function (w) { return { cwd: Term.cwd(w) }; }
    },
    topic: {
      key: function (arg) { return 'topic:' + arg.id; },
      valid: function (arg) { return !!(arg && Subjects.find(arg.id)); },
      title: function (arg) { return topicTitle(arg.id); },
      size: function (d) { return [Math.min(1060, d.w * .72), d.h * .92]; },
      pos: function (d, w) { return [Math.max(12, d.w - w.w - 16), Math.max(8, (d.h - w.h) / 2)]; },
      render: function (box, arg) { TopicView.render(box, Subjects.find(arg.id), arg.tab); },
      reuse: function (w, arg) { if (arg.tab && w.content._openTab) w.content._openTab(arg.tab); },
      hash: function (arg) { const tab = Store.get('tab:' + arg.id, null); return '#/t/' + arg.id + (tab ? '/' + tab : ''); },
      saveArg: function (w) { return { id: w.arg.id }; }
    },
    courses: {
      live: true,
      title: function () { return 'courses — today, stats, topics'; },
      size: function (d) { return [Math.min(1120, d.w * .74), d.h * .92]; },
      render: function (box) { HomeView.render(box); },
      hash: function () { return '#/courses'; }
    },
    calendar: {
      title: function () { return 'calendar'; },
      size: function (d) { return [Math.min(980, d.w * .66), d.h * .92]; },
      render: function (box, arg) { CalendarView.render(box, arg && arg.month); },
      reuse: function (w, arg) { if (arg && arg.month) { w.arg = arg; WM.rerender(w); } },
      hash: function () { return '#/calendar'; },
      saveArg: function () { return {}; }
    },
    stats: {
      live: true,
      title: function () { return 'btop — progress'; },
      size: function (d) { return [Math.min(960, d.w * .64), d.h * .86]; },
      render: function (box) { StatsView.render(box); },
      hash: function () { return '#/stats'; }
    },
    materials: {
      title: function () { return 'ranger ~/materials'; },
      size: function (d) { return [Math.min(860, d.w * .6), d.h * .86]; },
      render: function (box) { MaterialsView.render(box); },
      hash: function () { return '#/materials'; }
    },
    jaba: {
      title: function (arg) { return 'jaba ~/code/' + ((arg && arg.file) || ''); },
      size: function (d) { return [Math.min(1100, d.w * .74), d.h * .88]; },
      render: function (box, arg, w) { JabaView.render(box, arg, w); },
      reuse: function (w, arg) { if (arg && arg.file && arg.file !== (w.arg && w.arg.file)) { w.arg = arg; WM.rerender(w); } },
      hash: function (arg) { return '#/jaba' + (arg && arg.file ? '/' + encodeURIComponent(arg.file) : ''); },
      onFocus: function (w) { if (w.focusEditor) w.focusEditor(); },
      onClose: function (w) { if (w.onCloseApp) w.onCloseApp(); },
      saveArg: function (w) { return { file: w.arg && w.arg.file }; }
    },
    settings: {
      title: function () { return 'settings'; },
      size: function (d) { return [Math.min(720, d.w * .52), Math.min(620, d.h * .8)]; },
      render: function (box) { SettingsView.render(box); },
      hash: function () { return '#/settings'; }
    }
  };

  // Пункты лаунчера (rofi)
  function launchers() {
    return [
      { name: 'terminal', note: 'zsh · Alt+Enter', run: function () { WM.open('term'); } },
      { name: 'courses', note: 'today, stats and every topic', run: function () { go('#/courses'); } },
      { name: 'calendar', note: 'reviews and the plan until the OGE', run: function () { go('#/calendar'); } },
      { name: 'btop', note: 'progress monitor', run: function () { go('#/stats'); } },
      { name: 'ranger', note: 'materials from Telegram', run: function () { go('#/materials'); } },
      { name: 'settings', note: 'export, import, reset progress', run: function () { go('#/settings'); } },
      { name: 'pop-quiz', note: '10 questions on mastered topics', run: function () { PopQuiz.open(); } },
      { name: 'jaba', note: 'our mini programming language, for when you\'re bored', run: function () { go('#/jaba'); } },
      { name: 'theme', note: 'next wallpaper: ' + Themes.ORDER.join(', '), run: Themes.next }
    ];
  }

  // Открыть окно по адресу; уже открытое — просто вынести наверх
  function go(hash) {
    const parts = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(function (p) {
      try { return decodeURIComponent(p); } catch (e) { return p; }
    });
    const page = parts[0];
    if (page === 't' && parts[1] && Subjects.find(parts[1])) return WM.open('topic', { id: parts[1], tab: parts[2] || null });
    if (page === 'calendar') return WM.open('calendar', { month: parts[1] || null });
    if (page === 'jaba') return WM.open('jaba', { file: parts.slice(1).join('/') || null });
    if (APPS[page] && page !== 'term' && page !== 'topic') return WM.open(page, {});
    const f = WM.focused();
    if (f && f.app === 'term') return f;
    const t = WM.list().filter(function (w) { return w.app === 'term'; }).pop();
    return t ? (WM.focus(t, true), t) : WM.open('term', {});
  }

  function start() {
    const root = document.getElementById('root');
    root.innerHTML = '';
    Themes.mount(root);
    WM.init(root, APPS);
    const restored = WM.restore();
    if (!restored) WM.open('term', {});
    const hash = location.hash;
    if (hash && hash !== '#/' && hash !== '#') go(hash);
    else if (!WM.focused()) go('#/');   // после загрузки всегда есть активное окно

    // Ссылки #/… открывают окна, а не перезагружают «страницу»
    document.addEventListener('click', function (e) {
      const a = e.target.closest('a[href^="#/"]');
      if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      go(a.getAttribute('href'));
    });
    window.addEventListener('hashchange', function () { go(location.hash); });
    ['topic-closed', 'topic-fixed', 'practice-goal', 'progress-changed'].forEach(function (ev) {
      window.addEventListener(ev, function () { Plan.refresh(); WM.refreshLive(); });
    });
    window.addEventListener('offline', function () { UI.toast('No internet: videos won\'t load, everything else works.'); });
  }

  window.App = { start, go, launchers, topicPath: function (tp) { return Term.topicPath(tp); } };
})();
