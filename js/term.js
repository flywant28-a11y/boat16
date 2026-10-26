/* =========================================================
   zsh — терминал рабочего стола.
   Файловая система учёбы:
     ~/social/NN-<id>   темы обществознания (54)
     ~/math/NN-<id>     темы математики (38, без «m-» в имени)
     ~/materials/       материалы из Telegram (открывает окно)
     ~/README.md, ~/.zshrc
   Команды открывают окна (learn, calendar, stats…) или печатают ответ
   (ls, today, cal, plan, grep…). Всё напечатанное можно нажимать:
   ссылки #/… открывают окна, [data-run] — выполняют команду здесь же.
   Tab — дополнение, ↑↓ — история (Store 'zsh_history'), Ctrl+L — очистить,
   Ctrl+C — прервать строку.
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;
  const USER = 'student', HOST = 'boat16';
  const HIST_MAX = 200;
  let greeted = false;   // первый терминал за заход показывает ещё и «today»

  function pad2(n) { return String(n).padStart(2, '0'); }
  function fname(tp) { return pad2(tp.num) + '-' + tp.id.replace(/^m-/, ''); }
  function topicPath(tp) { return Subjects.of(tp.id) + '/' + fname(tp); }

  /* ---------- Файловая система ---------- */
  const FILES = {
    'README.md': [
      '# boat16 — OGE prep in social studies and math',
      '',
      'Every topic goes: video → notes → review → practice.',
      'Then two reviews: after 3 days and after 7 days.',
      '',
      'Start here:',
      '  today            what to do right now',
      '  ls social        all social studies topics',
      '  learn social 1   open the first topic',
      '  help             every command',
      '',
      'Windows: drag by the title, resize from the corner, Alt+Enter opens a new terminal.'
    ].join('\n'),
    '.zshrc': [
      '# ~/.zshrc',
      'export EDITOR=nvim',
      'export OGE_GOAL=5',
      'alias ll="ls -l"',
      'alias open="learn"',
      'alias top="stats"',
      'PROMPT="%n@%m [%*] [%~]',
      '-> %% "',
      'neofetch'
    ].join('\n')
  };

  // Путь — массив: [] — домашняя папка, ['social'], ['social', '03-sfery']
  function resolve(cwd, p) {
    if (!p || p === '~') return [];
    let parts;
    if (p[0] === '/') {
      const home = '/home/' + USER;
      if (p !== home && p.indexOf(home + '/') !== 0) return null;
      parts = [];
      p = p.slice(home.length);
    } else if (p.indexOf('~/') === 0) { parts = []; p = p.slice(2); }
    else parts = cwd.slice();
    p.split('/').forEach(function (seg) {
      if (!seg || seg === '.') return;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    });
    return parts;
  }

  function node(parts) {
    if (!parts) return null;
    if (!parts.length) return { type: 'dir', name: '~' };
    const top = parts[0].replace(/\/$/, '');
    if (parts.length === 1 && FILES[top] !== undefined) return { type: 'file', name: top, text: FILES[top] };
    if (top === 'materials') return parts.length === 1 ? { type: 'dir', name: 'materials' } : null;
    if (top !== 'social' && top !== 'math') return null;
    if (parts.length === 1) return { type: 'dir', name: top, subject: top };
    if (parts.length > 2) return null;
    const tp = Subjects.get(top).topics.find(function (t) { return fname(t) === parts[1] || t.id === parts[1]; });
    return tp ? { type: 'topic', topic: tp } : null;
  }

  function children(parts) {
    const n = node(parts);
    if (!n || n.type !== 'dir') return [];
    if (!parts.length) return ['social/', 'math/', 'materials/', 'README.md', '.zshrc'];
    if (n.subject) return Subjects.get(n.subject).topics.map(fname);
    return [];
  }

  function pathText(parts) { return '~' + (parts.length ? '/' + parts.join('/') : ''); }

  /* ---------- Поиск темы по аргументу ----------
     «3» (в папке предмета), «social 3», «math/12», «03-sfery», «sfery»,
     «m-shiny» или слова из названия: «власть», «квадратные уравнения». */
  function findTopics(args, cwd) {
    const q = args.join(' ').trim();
    if (!q) return [];
    const two = /^(social|math)[\s/]+0*(\d+)$/.exec(q);
    if (two) {
      const tp = Subjects.get(two[1]).topics.find(function (t) { return t.num === +two[2]; });
      return tp ? [tp] : [];
    }
    if (/^\d+$/.test(q)) {
      const subj = cwd[0] === 'math' ? 'math' : cwd[0] === 'social' ? 'social' : null;
      if (!subj) return Subjects.ORDER.map(function (s) { return Subjects.get(s).topics.find(function (t) { return t.num === +q; }); }).filter(Boolean);
      const tp = Subjects.get(subj).topics.find(function (t) { return t.num === +q; });
      return tp ? [tp] : [];
    }
    const n = node(resolve(cwd, q));
    if (n && n.type === 'topic') return [n.topic];
    const all = Subjects.all();
    const byId = all.filter(function (t) { return t.id === q || t.id === 'm-' + q || fname(t) === q; });
    if (byId.length) return byId;
    const words = q.toLowerCase().split(/\s+/);
    return all.filter(function (t) {
      const text = (t.title + ' ' + fname(t)).toLowerCase();
      return words.every(function (w) { return text.indexOf(w) !== -1; });
    });
  }

  /* ---------- Мелочи вывода ---------- */
  const GLYPH = { 'new': '·', started: '◦', studied: '✓', today: '↻', overdue: '!', fixed: '★' };
  function code(id) { const st = Progress.status(id); return st.code === 'new' && st.started ? 'started' : st.code; }
  function tlink(tp, text, tab) { return '<a class="tl st-' + code(tp.id) + '" href="#/t/' + tp.id + (tab ? '/' + tab : '') + '">' + esc(text || topicPath(tp)) + '</a>'; }
  function run(cmd, text) { return '<button type="button" class="tr" data-run="' + esc(cmd) + '">' + esc(text || cmd) + '</button>'; }
  function padEnd(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }

  function lev(a, b) {
    const m = [];
    for (let i = 0; i <= a.length; i++) { m[i] = [i]; }
    for (let j = 0; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return m[a.length][b.length];
  }

  /* ---------- neofetch ---------- */
  const ART = [
    String.raw`                  .`,
    String.raw`                 /|\ `,
    String.raw`                / | \ `,
    String.raw`               /  |  \ `,
    String.raw`              / . | . \ `,
    String.raw`             / .o | o. \ `,
    String.raw`            / :oo | oo: \ `,
    String.raw`           / +ooo | ooo+ \ `,
    String.raw`          / +oooo | oooo+ \ `,
    String.raw`         /.oooooo | oooooo.\ `,
    String.raw`        /:ooooo+- | -+ooooo:\ `,
    String.raw`       '----------+----------'`,
    String.raw`    ______________|______________`,
    String.raw`    \oooooooooo boat16 ooooooooo/`,
    String.raw`     \+ooooooooooooooooooooooo+/`,
    String.raw`      '-:+ooooooooooooooooo+:-'`,
    String.raw`   ~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~`
  ];

  function neofetch() {
    const all = Subjects.all();
    let studied = 0, fixed = 0;
    all.forEach(function (tp) { const c = Progress.status(tp.id).code; if (c !== 'new') studied++; if (c === 'fixed') fixed++; });
    const ex = Plan.exams(), today = Progress.today();
    const dS = Progress.diffDays(today, ex.social), dM = Progress.diffDays(today, ex.math);
    const due = Progress.dueList(all).length;
    const st = Progress.streak();
    const rows = [
      ['OS', 'boat16 OGE 2027 x86_64'],
      ['Host', '9th grade'],
      ['Kernel', BOAT.version + '-oge'],
      ['Uptime', dS === dM ? dS + ' days until the OGE' + (ex.guess.social ? ' (approx.)' : '') : 'social ' + dS + 'd · math ' + dM + 'd until the OGE'],
      ['Packages', all.length + ' topics (' + Subjects.get('social').topics.length + ' social, ' + Subjects.get('math').topics.length + ' math)'],
      ['Shell', 'zsh 5.9'],
      ['WM', 'i3 (floating)'],
      ['Theme', Themes.current() + ' [GTK2/3]'],
      ['Terminal', 'alacritty'],
      ['Studied', studied + '/' + all.length + ' (' + Math.round(studied / all.length * 100) + '%)'],
      ['Mastered', fixed + ' ' + UI.plural(fixed, ['topic', 'topics'])],
      ['Reviews', due ? due + ' due today' : 'none due today'],
      ['Streak', st + ' ' + UI.plural(st, ['day', 'days'])],
      ['Practice', Math.round(Progress.daySec() / 60) + ' min today · ' + Bank.totalSolved() + ' tasks solved']
    ];
    const art = ART.map(function (l, i) { return '<span class="' + (i < 12 ? 'a1' : i < 16 ? 'a2' : 'a3') + '">' + esc(l) + '</span>'; }).join('\n');
    const info = '<span class="nf-u">' + USER + '</span>@<span class="nf-u">' + HOST + '</span>\n' + '-'.repeat(USER.length + HOST.length + 1) + '\n' +
      rows.map(function (r) { return '<span class="nf-k">' + r[0] + ':</span> ' + esc(r[1]); }).join('\n') + '\n\n' +
      '<span class="nf-pal">' + [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return '<i style="background:var(--c' + i + ')"></i>'; }).join('') + '</span>\n' +
      '<span class="nf-pal">' + [8, 9, 10, 11, 12, 13, 14, 15].map(function (i) { return '<i style="background:var(--c' + i + ')"></i>'; }).join('') + '</span>';
    return '<div class="nf"><pre class="nf-art" aria-hidden="true">' + art + '</pre><pre class="nf-info">' + info + '</pre></div>';
  }

  /* ---------- Команды ---------- */
  const TOPIC_CMDS = ['learn', 'open', 'less', 'vim', 'nvim', 'cat', 'notes', 'video', 'review', 'practice'];

  const CMDS = {
    help: { group: 'system', usage: 'help', desc: 'list every command', run: function (t) { t.print(helpText()); } },
    today: { group: 'learning', usage: 'today', desc: 'reviews due and the next topic in each subject', run: function (t) { t.print(todayText()); } },
    ls: {
      group: 'learning', usage: 'ls [-l] [dir]', desc: 'list topics; -l adds status and titles',
      run: function (t, args) {
        const long = args.some(function (a) { return /^-\w*l/.test(a); });
        const target = args.filter(function (a) { return a[0] !== '-'; })[0];
        lsText(t, target, long);
      }
    },
    ll: { usage: 'll [dir]', desc: 'same as ls -l', run: function (t, args) { lsText(t, args[0], true); } },
    cd: {
      group: 'learning', usage: 'cd <dir>', desc: 'go to social, math or materials',
      run: function (t, args) {
        let p = args[0];
        if (p === '-') p = t.oldCwd ? pathText(t.oldCwd) : '~';
        const parts = resolve(t.cwd, p);
        const n = node(parts);
        if (!n) return t.err('cd: no such file or directory: ' + args[0]);
        if (n.type !== 'dir') return t.err('cd: not a directory: ' + args[0]);
        if (parts[0] === 'materials') { App.go('#/materials'); t.print('<span class="dim">materials open in ranger.</span>'); return; }
        t.oldCwd = t.cwd;
        t.cwd = parts;
        WM.setTitle(t.win);
      }
    },
    pwd: { usage: 'pwd', desc: 'print the current folder', run: function (t) { t.print(esc('/home/' + USER + (t.cwd.length ? '/' + t.cwd.join('/') : ''))); } },
    learn: { group: 'learning', usage: 'learn <topic>', desc: 'open a topic (also: open, less, vim)', run: function (t, args) { openTopic(t, args, null); } },
    notes: { usage: 'notes <topic>', desc: 'open a topic on the notes tab', run: function (t, args) { openTopic(t, args, 'notes'); } },
    video: { usage: 'video <topic>', desc: 'open a topic on the video tab', run: function (t, args) { openTopic(t, args, 'video'); } },
    review: { usage: 'review <topic>', desc: 'open a topic on the review tab', run: function (t, args) { openTopic(t, args, 'review'); } },
    practice: { usage: 'practice <topic>', desc: 'open a topic on the practice tab', run: function (t, args) { openTopic(t, args, 'practice'); } },
    cat: {
      usage: 'cat <file>', desc: 'print a file; a topic opens on the notes tab',
      run: function (t, args) {
        if (!args.length) return t.err('cat: missing file name');
        const n = node(resolve(t.cwd, args[0]));
        if (n && n.type === 'file') return t.print('<pre class="cat">' + esc(n.text) + '</pre>');
        if (n && n.type === 'dir') return t.err('cat: ' + args[0] + ': is a directory');
        openTopic(t, args, 'notes');
      }
    },
    grep: {
      group: 'learning', usage: 'grep <words>', desc: 'find topics by title, section and subtopics',
      run: function (t, args) {
        const q = args.filter(function (a) { return a[0] !== '-'; }).join(' ').toLowerCase().trim();
        if (!q) return t.err('usage: grep <words>');
        const words = q.split(/\s+/);
        const hits = [];
        Subjects.all().forEach(function (tp) {
          const subs = (tp.subtopics || []).map(function (s) { return String(s.title).replace(/\$[^$]*\$/g, ''); });
          const text = (tp.title + ' ' + tp.section + ' ' + subs.join(' ')).toLowerCase();
          if (!words.every(function (w) { return text.indexOf(w) !== -1; })) return;
          const sub = subs.find(function (s) { return words.some(function (w) { return s.toLowerCase().indexOf(w) !== -1; }); });
          hits.push({ tp, sub });
        });
        if (!hits.length) return t.print('<span class="dim">no topics match “' + esc(q) + '”.</span>');
        t.print(hits.slice(0, 24).map(function (h) {
          return '<div class="row">' + tlink(h.tp) + ' <span class="fg2">' + esc(h.tp.title) + '</span>' + (h.sub && h.sub !== h.tp.title ? ' <span class="dim">› ' + esc(h.sub) + '</span>' : '') + '</div>';
        }).join('') + (hits.length > 24 ? '<div class="dim">… and ' + (hits.length - 24) + ' more — add a word to narrow it down.</div>' : ''));
      }
    },
    quiz: { group: 'learning', usage: 'quiz', desc: 'pop-quiz: 10 questions on mastered topics', run: function () { PopQuiz.open(); } },
    cal: { group: 'planning', usage: 'cal [yyyy-mm]', desc: 'month with reviews, planned topics and exams', run: function (t, args) { t.print(calText(args[0])); } },
    calendar: { group: 'planning', usage: 'calendar', desc: 'open the calendar window', run: function () { App.go('#/calendar'); } },
    plan: { group: 'planning', usage: 'plan', desc: 'exam dates, topics left and your pace', run: function (t) { t.print(planText()); } },
    courses: { group: 'planning', usage: 'courses', desc: 'dashboard: today, stats and every topic', run: function () { App.go('#/courses'); } },
    stats: { group: 'planning', usage: 'stats', desc: 'progress monitor (also: btop, top)', run: function () { App.go('#/stats'); } },
    materials: { group: 'system', usage: 'materials', desc: 'files and videos from Telegram (also: ranger)', run: function () { App.go('#/materials'); } },
    settings: { group: 'system', usage: 'settings', desc: 'export, import or reset progress', run: function () { App.go('#/settings'); } },
    neofetch: { group: 'system', usage: 'neofetch', desc: 'system info — your progress', run: function (t) { t.print(neofetch()); } },
    theme: {
      group: 'system', usage: 'theme [name]', desc: 'switch wallpaper and colors: ' + Themes.ORDER.join(', '),
      run: function (t, args) {
        if (args[0]) {
          if (!Themes.set(args[0])) return t.err('theme: unknown theme “' + args[0] + '”. Try: ' + Themes.ORDER.join(', '));
          return t.print('<span class="dim">theme set to</span> ' + esc(args[0]));
        }
        t.print(Themes.ORDER.map(function (n) {
          const on = n === Themes.current();
          return '<div class="row">' + (on ? '<span class="acc">*</span> ' : '  ') + run('theme ' + n, padEnd(n, 8)) + ' <span class="dim">' + esc(Themes.list[n].note) + '</span></div>';
        }).join(''));
      }
    },
    history: {
      group: 'system', usage: 'history', desc: 'commands you typed',
      run: function (t) {
        const h = Store.get('zsh_history', []);
        t.print(h.slice(-30).map(function (c, i) { return '<div class="row"><span class="dim">' + String(h.length - Math.min(30, h.length) + i + 1).padStart(5, ' ') + '</span>  ' + run(c) + '</div>'; }).join('') || '<span class="dim">empty</span>');
      }
    },
    clear: { group: 'system', usage: 'clear', desc: 'clear the screen (Ctrl+L)', run: function (t) { t.clear(); } },
    man: {
      group: 'system', usage: 'man <command>', desc: 'how a command works',
      run: function (t, args) {
        const c = CMDS[ALIAS[args[0]] || args[0]];
        if (!args[0]) return t.err('What manual page do you want? Try: man learn');
        if (!c) return t.err('No manual entry for ' + args[0]);
        t.print('<div class="man"><b>' + esc(args[0]) + '</b> — ' + esc(c.desc) + '\n\n<span class="dim">usage:</span> ' + esc(c.usage) + (TOPIC_CMDS.indexOf(args[0]) !== -1 ? '\n\n<span class="dim">topic can be:</span>  3 (inside social/ or math/) · social 3 · math/12 · 03-sfery · sfery · a word from the title, like власть' : '') + '</div>');
      }
    },
    whoami: { usage: 'whoami', desc: 'user name', run: function (t) { t.print(USER); } },
    date: { usage: 'date', desc: 'today’s date and time', run: function (t) { t.print(esc(new Date().toString().replace(/ \(.*\)$/, ''))); } },
    uname: { usage: 'uname [-a]', desc: 'system name', run: function (t, args) { t.print(args[0] === '-a' ? 'Linux ' + HOST + ' ' + BOAT.version + '-oge #1 SMP PREEMPT x86_64 GNU/Linux' : 'Linux'); } },
    echo: { usage: 'echo <text>', desc: 'print text', run: function (t, args) { t.print(esc(args.join(' '))); } },
    exit: { group: 'system', usage: 'exit', desc: 'close this terminal', run: function (t) { WM.close(t.win); } },
    reboot: { usage: 'reboot', desc: 'reload the page', run: function () { location.reload(); } },
    sudo: { usage: 'sudo', desc: '', run: function (t) { t.err(USER + ' is not in the sudoers file. This incident will be reported.'); } },
    pacman: { usage: 'pacman', desc: '', run: function (t) { t.err('error: you cannot perform this operation unless you are root.'); } },
    rm: { usage: 'rm', desc: '', run: function (t) { t.err('rm: progress is precious. To start over, use settings → reset everything.'); } }
  };
  const ALIAS = { open: 'learn', less: 'learn', vim: 'learn', nvim: 'learn', btop: 'stats', htop: 'stats', top: 'stats', ranger: 'materials', cls: 'clear', fastfetch: 'neofetch', 'yay': 'pacman' };

  function openTopic(t, args, tab) {
    if (!args.length) return t.err('usage: learn <topic> — for example: learn social 1, learn sfery, learn власть');
    const list = findTopics(args, t.cwd);
    if (!list.length) return t.err('no topic matches “' + args.join(' ') + '”. Try: grep ' + args.join(' '));
    if (list.length > 1) {
      t.print('<div class="dim">' + list.length + ' topics match — pick one:</div>' + list.slice(0, 20).map(function (tp) {
        return '<div class="row">' + tlink(tp, null, tab) + ' <span class="fg2">' + esc(tp.title) + '</span></div>';
      }).join(''));
      return;
    }
    const tp = list[0];
    t.print('<span class="dim">opening</span> ' + tlink(tp, null, tab) + ' <span class="fg2">' + esc(tp.title) + '</span>');
    App.go('#/t/' + tp.id + (tab ? '/' + tab : ''));
  }

  /* ---------- Тексты команд ---------- */
  function helpText() {
    const groups = { learning: [], planning: [], system: [] };
    Object.keys(CMDS).forEach(function (k) { if (CMDS[k].group) groups[CMDS[k].group].push(k); });
    let html = '<div class="help"><div class="fg2">boat16 zsh — click any command to run it.</div>';
    Object.keys(groups).forEach(function (g) {
      html += '<div class="h-g">' + g + '</div>';
      groups[g].forEach(function (k) {
        const c = CMDS[k];
        html += '<div class="row">  ' + run(k === 'learn' ? 'learn social 1' : k === 'theme' ? 'theme' : k, padEnd(c.usage, 18)) + ' <span class="dim">' + esc(c.desc) + '</span></div>';
      });
    });
    html += '<div class="h-g">topic commands</div><div class="row">  <span class="fg2">notes, video, review, practice &lt;topic&gt;</span> <span class="dim">open a topic on that tab</span></div>';
    html += '<div class="h-g">keys</div><div class="dim">  Tab completes · ↑↓ history · Ctrl+L clears · Alt+Enter new terminal · Alt+D launcher · Alt+Q close window · Alt+1…4 workspaces</div></div>';
    return html;
  }

  function todayText() {
    const all = Subjects.all();
    const rows = [];
    Progress.dueList(all).forEach(function (tp) {
      const st = Progress.status(tp.id);
      rows.push([st.code === 'overdue' ? '!' : '↻', st.code === 'overdue' ? 'bad' : 'warn', st.code === 'overdue' ? 'overdue' : 'review', tp, st.mock ? 'after mock exam' : st.label, 'practice']);
    });
    const last = Store.get('last', null);
    const lf = last && Subjects.find(last);
    if (lf && Progress.status(last).code === 'new') rows.push(['◦', 'fg2', 'continue', lf.topic, Progress.status(last).label, null]);
    Subjects.ORDER.forEach(function (s) {
      const next = Progress.nextNew(Subjects.get(s).topics.filter(function (tp) { return tp.id !== last; }));
      if (next) rows.push(['·', 'dim', 'next', next, 'new topic', null]);
    });
    const day = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toLowerCase();
    let html = '<div class="fg2">today · ' + esc(day) + '</div>';
    if (!rows.length) html += '<div class="ok">All done for today.</div>';
    rows.forEach(function (r) {
      html += '<div class="row"> <span class="' + r[1] + '">' + r[0] + ' ' + padEnd(r[2], 9) + '</span>' + tlink(r[3], padEnd(topicPath(r[3]), 24), r[5]) + ' <span class="fg2">' + esc(r[3].title) + '</span> <span class="dim">' + esc(r[4]) + '</span></div>';
    });
    if (PopQuiz.fixedTopics().length) html += '<div class="dim">mastered topics to refresh: ' + run('quiz') + '</div>';
    return html;
  }

  function lsText(t, target, long) {
    const parts = resolve(t.cwd, target || '');
    const n = node(parts);
    if (!n) return t.err('ls: cannot access \'' + target + '\': No such file or directory');
    if (n.type === 'topic') return t.print(long ? longRow(n.topic) : tlink(n.topic, fname(n.topic)));
    if (n.type === 'file') return t.print(esc(n.name));
    if (parts[0] === 'materials') {
      return t.print(MATERIALS.groups.map(function (g) { return '<div class="row"><a class="dir" href="#/materials">' + esc(g.title.toLowerCase()) + '/</a> <span class="dim">' + g.items.length + ' files</span></div>'; }).join(''));
    }
    if (!parts.length) {
      const items = [['social/', 'dir', 'ls social'], ['math/', 'dir', 'ls math'], ['materials/', 'dir', 'materials'], ['README.md', 'file', 'cat README.md']];
      if (long || target === '-a') items.push(['.zshrc', 'file', 'cat .zshrc']);
      if (long) {
        return t.print(items.map(function (it) {
          const info = it[0] === 'social/' ? Subjects.get('social').topics.length + ' topics' : it[0] === 'math/' ? Subjects.get('math').topics.length + ' topics' : it[0] === 'materials/' ? 'telegram files' : '';
          return '<div class="row"><span class="dim">' + (it[1] === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--') + '  student </span>' + run(it[2], padEnd(it[0], 12)) + ' <span class="dim">' + info + '</span></div>';
        }).join(''));
      }
      return t.print('<div class="cols">' + items.map(function (it) { return '<button type="button" class="tr ' + it[1] + '" data-run="' + it[2] + '">' + it[0] + '</button>'; }).join('') + '</div>');
    }
    const topics = Subjects.get(n.subject).topics;
    if (long) {
      let html = '<div class="dim">total ' + topics.length + ' · ✓ studied ↻ review ! overdue ★ mastered</div>';
      let section = null;
      topics.forEach(function (tp) {
        if (tp.section !== section) { section = tp.section; html += '<div class="ls-sec"># ' + esc(section) + '</div>'; }
        html += longRow(tp);
      });
      return t.print(html);
    }
    t.print('<div class="cols" style="--cw:' + (Math.max.apply(null, topics.map(function (tp) { return fname(tp).length; })) + 2) + 'ch">' +
      topics.map(function (tp) { return tlink(tp, fname(tp)); }).join('') + '</div><div class="dim">ls -l shows titles and status · learn &lt;number&gt; opens a topic</div>');
  }

  function longRow(tp) {
    const c = code(tp.id);
    const pct = Math.round(Progress.percent(tp.id));
    return '<div class="row lsl"><span class="st-' + c + ' g">' + GLYPH[c] + '</span> <span class="dim">' + String(pct).padStart(3, ' ') + '%</span> ' +
      tlink(tp, padEnd(fname(tp), 24)) + ' <span class="fg2">' + esc(tp.title) + '</span></div>';
  }

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function calText(arg) {
    const today = Progress.today();
    const m = arg && /^\d{4}-\d{2}$/.test(arg) ? arg : today.slice(0, 7);
    const y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1;
    const title = MONTHS[mo] + ' ' + y;
    let html = '<pre class="cal">' + ' '.repeat(Math.max(0, Math.floor((20 - title.length) / 2))) + '<b>' + title + '</b>\n<span class="dim">Mo Tu We Th Fr Sa Su</span>\n';
    const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
    const days = new Date(y, mo + 1, 0).getDate();
    let col = lead;
    html += '   '.repeat(lead);
    for (let d = 1; d <= days; d++) {
      const k = y + '-' + pad2(mo + 1) + '-' + pad2(d);
      const info = Plan.day(k);
      let cls = '';
      if (info.exam.length) cls = 'c-ex';
      else if (k === today) cls = 'c-today';
      else if (info.overdue.length || info.reviews.length) cls = 'c-rev';
      else if (info.planned.length) cls = 'c-plan';
      else if (k < today && (info.closed.length || info.passed.length || info.minutes)) cls = 'c-done';
      html += '<a href="#/calendar/' + m + '" class="' + cls + '">' + String(d).padStart(2, ' ') + '</a>';
      col++;
      if (col % 7 === 0 && d < days) html += '\n';
      else if (d < days) html += ' ';
    }
    html += '</pre><div class="cal-key"><span class="c-today">today</span> <span class="c-rev">reviews</span> <span class="c-plan">new topics</span> <span class="c-done">studied</span> <span class="c-ex">oge</span> · ' + run('calendar', 'open calendar') + '</div>';
    return html;
  }

  function fmt(x) { return (Math.round(x * 10) / 10).toString(); }
  function planText() {
    const info = Plan.info();
    let html = '';
    Subjects.ORDER.forEach(function (s) {
      const i = info[s];
      const days = Progress.diffDays(Progress.today(), i.exam);
      let verdict;
      if (!i.left) verdict = '<span class="ok">✓ all topics studied — only reviews left</span>';
      else if (!i.have) verdict = '<span class="warn">no new topics in 2 weeks — the plan is waiting</span>';
      else if (i.eta <= i.finish) verdict = '<span class="ok">✓ on track: you’ll finish ' + esc(Progress.human(i.eta)) + '</span>';
      else verdict = '<span class="bad">✗ behind: you’ll finish ' + esc(Progress.human(i.eta)) + ', need ' + esc(Progress.human(i.finish)) + '</span>';
      html += '<div class="plan-t"><span class="acc">' + padEnd(s, 7) + '</span> oge ' + i.exam + ' <span class="dim">(' + days + ' days' + (i.guess ? ', approximate — set it in ' : ')') + '</span>' + (i.guess ? run('calendar') + '<span class="dim">)</span>' : '') +
        '\n        ' + i.left + ' ' + UI.plural(i.left, ['topic', 'topics']) + ' left · new topics by ' + esc(Progress.human(i.finish)) + ' · need ' + fmt(i.need * 7) + '/wk · your pace ' + fmt(i.have * 7) + '/wk\n        ' + verdict + '</div>';
    });
    return html;
  }

  /* ---------- Терминал ---------- */
  function prompt(t) {
    const now = new Date();
    const time = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
    return '<span class="p-u">' + USER + '@' + HOST + '</span> <span class="p-t">[' + time + ']</span> <span class="p-d">[' + esc(pathText(t.cwd)) + ']</span>';
  }

  function mount(box, arg, win) {
    const t = { win: win, cwd: (arg && arg.cwd) || [], oldCwd: null };
    win.term = t;
    box.classList.add('term');
    const out = el('div', 'term-out');
    out.setAttribute('role', 'log');
    out.setAttribute('aria-live', 'polite');
    const line = el('div', 'term-line');
    const p1 = el('div', 'p1');
    const p2 = el('label', 'p2', '<span class="p-a">-&gt;</span> <span class="p-s">%</span>');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'term-in';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Command');
    input.enterKeyHint = 'go';
    p2.appendChild(input);
    line.appendChild(p1);
    line.appendChild(p2);
    box.appendChild(out);
    box.appendChild(line);
    t.input = input;

    function scroll() { win.body.scrollTop = win.body.scrollHeight; }
    t.print = function (html) { out.appendChild(el('div', 'o', html)); scroll(); };
    t.err = function (text) { out.appendChild(el('div', 'o err', esc(text))); scroll(); };
    t.clear = function () { out.innerHTML = ''; };
    function paintPrompt() { p1.innerHTML = prompt(t); }

    let hist = Store.get('zsh_history', []);
    let hpos = hist.length, draft = '';

    function exec(cmdline) {
      out.appendChild(el('div', 'o echo', '<div class="p1">' + prompt(t) + '</div><div><span class="p-a">-&gt;</span> <span class="p-s">%</span> ' + esc(cmdline) + '</div>'));
      const text = cmdline.trim();
      if (text) {
        hist = Store.get('zsh_history', []);
        if (hist[hist.length - 1] !== text) hist.push(text);
        if (hist.length > HIST_MAX) hist = hist.slice(-HIST_MAX);
        Store.set('zsh_history', hist);
        hpos = hist.length;
        text.split(/\s*(?:&&|;)\s*/).forEach(function (part) { if (part) runLine(part); });
      }
      paintPrompt();
      scroll();
    }

    function runLine(text) {
      const args = (text.match(/"[^"]*"|'[^']*'|\S+/g) || []).map(function (a) { return a.replace(/^["']|["']$/g, ''); });
      const name = args.shift();
      const c = CMDS[ALIAS[name] || name];
      if (!c) {
        const guess = Object.keys(CMDS).concat(Object.keys(ALIAS)).map(function (k) { return [k, lev(name, k)]; }).sort(function (a, b) { return a[1] - b[1]; })[0];
        t.err('zsh: command not found: ' + name);
        if (guess && guess[1] <= 2) t.print('<span class="dim">did you mean</span> ' + run(guess[0] + (args.length ? ' ' + args.join(' ') : '')) + '<span class="dim">?</span>');
        else t.print('<span class="dim">type</span> ' + run('help') + ' <span class="dim">to see every command.</span>');
        return;
      }
      try { c.run(t, args); }
      catch (e) { t.err(name + ': ' + e.message); }
    }
    t.exec = exec;

    // Tab: команда, затем путь, тема или имя темы оформления
    function complete() {
      const v = input.value;
      const words = v.split(/\s+/);
      const last = words[words.length - 1];
      let pool;
      if (words.length === 1) pool = Object.keys(CMDS).concat(Object.keys(ALIAS)).filter(function (k) { return CMDS[k] ? CMDS[k].desc : true; });
      else {
        const cmd = ALIAS[words[0]] || words[0];
        if (cmd === 'theme') pool = Themes.ORDER.slice();
        else if (cmd === 'man') pool = Object.keys(CMDS);
        else {
          const slash = last.lastIndexOf('/');
          const dir = slash === -1 ? '' : last.slice(0, slash + 1);
          pool = children(resolve(t.cwd, dir || '')).map(function (c) { return dir + c; });
          if (cmd === 'cd') pool = pool.filter(function (c) { return /\/$/.test(c); });
        }
      }
      const hits = pool.filter(function (c) { return c.indexOf(last) === 0; });
      if (!hits.length) return;
      let common = hits[0];
      hits.forEach(function (h) { while (h.indexOf(common) !== 0) common = common.slice(0, -1); });
      if (hits.length === 1) common = hits[0] + (/\/$/.test(hits[0]) ? '' : ' ');
      if (common.length > last.length) {
        words[words.length - 1] = common;
        input.value = words.join(' ');
      } else {
        out.appendChild(el('div', 'o echo', '<span class="p-a">-&gt;</span> <span class="p-s">%</span> ' + esc(v)));
        t.print('<div class="cols">' + hits.slice(0, 80).map(function (h) { return '<span>' + esc(h) + '</span>'; }).join('') + '</div>');
      }
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); const v = input.value; input.value = ''; exec(v); }
      else if (e.key === 'Tab') { e.preventDefault(); complete(); }
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (hpos === hist.length) draft = input.value;
        if (hpos > 0) { hpos--; input.value = hist[hpos]; }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (hpos < hist.length) { hpos++; input.value = hpos === hist.length ? draft : hist[hpos]; }
      } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); t.clear(); }
      else if (e.ctrlKey && (e.key === 'c' || e.key === 'C') && !window.getSelection().toString()) {
        e.preventDefault();
        out.appendChild(el('div', 'o echo', '<span class="p-a">-&gt;</span> <span class="p-s">%</span> ' + esc(input.value) + '<span class="dim">^C</span>'));
        input.value = '';
        paintPrompt();
      }
    });

    // Клик по выводу: команда из [data-run]; по пустому месту — фокус в строку
    box.addEventListener('click', function (e) {
      const b = e.target.closest('[data-run]');
      if (b) { exec(b.getAttribute('data-run')); input.focus({ preventScroll: true }); return; }
      if (e.target.closest('a, button, input')) return;
      if (!window.getSelection().toString()) input.focus({ preventScroll: true });
    });

    paintPrompt();
    t.print(neofetch());
    if (!greeted) {
      greeted = true;
      t.print(todayText());
      t.print('<div class="dim">type ' + run('help') + ' for commands, or ' + (narrow() ? 'tap anything above. Apps and windows: the sail in the corner.' : 'click anything above. Launcher: Alt+D or the sail in the corner.') + '</div>');
    }
    setTimeout(function () { if (WM.focused() === win && !narrow()) input.focus({ preventScroll: true }); }, 30);
  }

  // На телефоне не открываем клавиатуру сама по себе
  function narrow() { return window.matchMedia('(max-width: 760px)').matches; }

  window.Term = {
    mount, topicPath, fname,
    focus: function (win) { if (win.term && !narrow()) win.term.input.focus({ preventScroll: true }); },
    title: function (win) { return USER + '@' + HOST + ': ' + (win.term ? pathText(win.term.cwd) : '~'); },
    cwd: function (win) { return win.term ? win.term.cwd.slice() : []; }
  };
})();
