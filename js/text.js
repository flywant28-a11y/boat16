/* =========================================================
   Текст шпоры: формулы KaTeX, рисунки и разметка строк source.
     $...$        — формула в строке, строка '$$...$$' — формула блоком;
     [[fig:имя]]  — рисунок math/img/figs/имя.webp;
     [[img:имя]]  — рисунок разбора review/img/имя.webp;
     # заголовок, ! заметка, - пункт, 1. пункт, | таблица |,
     **жирный**, *курсив*, {термин}, @chart — графики спроса и предложения.
   Text.rich(s)   — строка с формулами и **жирным** (объяснения, ответы);
   Text.source(lines) — блок шпоры; Text.render(node) — отрисовать формулы.
   Text.termMatches — проверка вписанного термина (окончания и опечатки).
   ========================================================= */
(function () {
  'use strict';

  const esc = UI.esc;
  const FIG_RE = /\[\[(fig|img):([A-Za-z0-9_.-]+)\]\]/g;
  const KATEX = {
    delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
    throwOnError: false, strict: 'ignore',
    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option', 'input']
  };

  // Куски строки: формулы отдельно от текста — разметка не должна задевать TeX
  function protect(s, fn) {
    const re = /\$\$[^$]+\$\$|\$[^$]+\$/g;
    let out = '', last = 0, m;
    s = String(s);
    while ((m = re.exec(s))) {
      if (m.index > last) out += fn(s.slice(last, m.index));
      out += esc(m[0]);
      last = m.index + m[0].length;
    }
    return out + (last < s.length ? fn(s.slice(last)) : '');
  }

  function inline(s) {
    return protect(s, function (part) {
      return esc(part)
        .replace(/\{(.+?)\}/g, '<span class="src-term">$1</span>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');
    });
  }

  function rich(s) {
    return protect(s, function (part) {
      return esc(part).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    });
  }

  function figSrc(kind, name) { return (kind === 'fig' ? 'math/img/figs/' : 'review/img/') + name + '.webp'; }

  function figure(kind, name, photo) {
    const src = figSrc(kind, name);
    return '<figure class="fig' + (photo ? ' photo' : '') + '"><button type="button" class="fig-btn" data-src="' + esc(src) + '"' +
      (photo ? ' data-photo="1"' : '') + ' aria-label="Увеличить рисунок"><img src="' + esc(src) + '" alt="" loading="lazy"></button></figure>';
  }

  function hasFigure(s) { FIG_RE.lastIndex = 0; return FIG_RE.test(s); }

  function figures(s, fn) {
    let out = '', last = 0, m;
    FIG_RE.lastIndex = 0;
    while ((m = FIG_RE.exec(s))) {
      if (m.index > last) out += fn(s.slice(last, m.index));
      out += figure(m[1], m[2]);
      last = m.index + m[0].length;
    }
    return out + (last < s.length ? fn(s.slice(last)) : '');
  }

  // KaTeX ругается на ①②③ без метрик (они из шпаргалки) — глушим только это
  function quietly(fn) {
    const warn = console.warn;
    console.warn = function (msg) {
      if (typeof msg === 'string' && msg.indexOf('No character metrics') === 0) return;
      return warn.apply(console, arguments);
    };
    try { fn(); } finally { console.warn = warn; }
  }

  function render(node) {
    if (!node) return;
    if (typeof window.renderMathInElement === 'function') quietly(function () { window.renderMathInElement(node, KATEX); });
    node.querySelectorAll('.fig-btn:not([data-bound])').forEach(function (b) {
      b.setAttribute('data-bound', '1');
      b.addEventListener('click', function () { UI.lightbox(b.getAttribute('data-src'), { photo: !!b.getAttribute('data-photo') }); });
    });
  }

  /* ---------- Блок шпоры ---------- */
  function supplyDemandCharts(labels) {
    function axes(inner) {
      return '<svg viewBox="0 0 120 100" aria-hidden="true"><path class="ax" d="M18 8V86H112"/><text x="6" y="14">P</text><text x="106" y="97">Q</text>' + inner + '</svg>';
    }
    const d = '<path class="ln d" d="M30 18L100 78"/><text class="d" x="100" y="72">D</text>';
    const s = '<path class="ln s" d="M30 78L100 18"/><text class="s" x="100" y="16">S</text>';
    const eq = '<path class="dash" d="M18 48H65V86"/><text x="2" y="52">P*</text>';
    const names = labels.length >= 3 ? labels : ['Спрос', 'Предложение', 'Крест Маршалла'];
    return '<div class="src-charts">' +
      '<figure>' + axes(d) + '<figcaption>' + esc(names[0]) + '</figcaption></figure>' +
      '<figure>' + axes(s) + '<figcaption>' + esc(names[1]) + '</figcaption></figure>' +
      '<figure>' + axes(d + s + eq) + '<figcaption>' + esc(names[2]) + '</figcaption></figure></div>';
  }

  function cell(text) {
    const lines = text.split('\n');
    let html = '', list = [], tag = 'ul';
    function flush() { if (list.length) { html += '<' + tag + '>' + list.join('') + '</' + tag + '>'; list = []; } }
    lines.forEach(function (ln) {
      const m = ln.match(/^(- |\d+\. )/);
      if (m) {
        const t = m[1] === '- ' ? 'ul' : 'ol';
        if (list.length && t !== tag) flush();
        tag = t;
        list.push('<li>' + inline(ln.slice(m[1].length)) + '</li>');
        return;
      }
      flush();
      html += (html && !/<\/[uo]l>$/.test(html) ? '<br>' : '') + inline(ln);
    });
    flush();
    return html;
  }

  function cellsOf(row) { return row.replace(/^\|#?\s?/, '').replace(/\s?\|\s*$/, '').split(' | '); }

  function table(lines, i, root) {
    const rows = [];
    while (i < lines.length && lines[i].charAt(0) === '|') {
      if (rows.length && lines[i].charAt(1) === '#' && !rows[rows.length - 1].head) break;
      rows.push({ head: lines[i].charAt(1) === '#', cells: cellsOf(lines[i]) });
      i++;
    }
    let cols = 1;
    rows.forEach(function (r) { cols = Math.max(cols, r.cells.length); });
    let html = '<div class="src-table"><table>';
    rows.forEach(function (r) {
      if (r.cells.length === 1 && cols > 1) { html += '<tr class="span"><td colspan="' + cols + '">' + cell(r.cells[0]) + '</td></tr>'; return; }
      html += '<tr>' + r.cells.map(function (c) {
        if (r.head) return '<th>' + cell(c) + '</th>';
        if (c.charAt(0) === '^') return '<td class="head">' + cell(c.slice(1)) + '</td>';
        return '<td>' + cell(c) + '</td>';
      }).join('') + '</tr>';
    });
    root.insertAdjacentHTML('beforeend', html + '</table></div>');
    return i;
  }

  function bullets(lines, i, root) {
    let html = '<ul>', depth = 0;
    while (i < lines.length && /^ *- /.test(lines[i])) {
      const d = lines[i].match(/^ */)[0].length >= 2 ? 1 : 0;
      if (d > depth) html += '<ul>';
      else if (d < depth) html += '</li></ul></li>';
      else if (html !== '<ul>') html += '</li>';
      depth = d;
      html += '<li>' + inline(lines[i].replace(/^ *- /, ''));
      i++;
    }
    html += depth ? '</li></ul></li>' : '</li>';
    root.insertAdjacentHTML('beforeend', html + '</ul>');
    return i;
  }

  function numbered(lines, i, root) {
    let html = '<ol class="src-ol">';
    while (i < lines.length && /^\d+\. /.test(lines[i])) {
      const m = lines[i].match(/^(\d+)\. (.*)$/);
      html += '<li><span class="n">' + m[1] + '</span><span>' + inline(m[2]) + '</span></li>';
      i++;
    }
    root.insertAdjacentHTML('beforeend', html + '</ol>');
    return i;
  }

  function source(lines) {
    const root = UI.el('div', 'src');
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line) { i++; continue; }
      if (line.charAt(0) === '|') { i = table(lines, i, root); continue; }
      if (/^ *- /.test(line)) { i = bullets(lines, i, root); continue; }
      if (/^\d+\. /.test(line)) { i = numbered(lines, i, root); continue; }
      if (/^\$\$[^$]+\$\$$/.test(line)) root.insertAdjacentHTML('beforeend', '<div class="math-block">' + esc(line) + '</div>');
      else if (hasFigure(line)) root.insertAdjacentHTML('beforeend', figures(line, function (t) { return t.trim() ? '<p>' + inline(t) + '</p>' : ''; }));
      else if (line.indexOf('@chart') === 0) root.insertAdjacentHTML('beforeend', supplyDemandCharts(line.split('|').slice(1).map(function (x) { return x.trim(); })));
      else if (line.indexOf('# ') === 0) root.insertAdjacentHTML('beforeend', '<h4>' + inline(line.slice(2)) + '</h4>');
      else if (line.indexOf('! ') === 0) root.insertAdjacentHTML('beforeend', '<div class="src-note"><span>' + inline(line.slice(2)) + '</span></div>');
      else root.insertAdjacentHTML('beforeend', '<p>' + inline(line) + '</p>');
      i++;
    }
    return root;
  }

  /* ---------- Проверка вписанного термина ---------- */
  const ENDINGS = ['ированиями', 'ированием', 'ирования', 'ировать', 'остями', 'ость', 'ости', 'остью', 'остей',
    'ениями', 'ением', 'ения', 'ение', 'ении', 'ений', 'ениям', 'ениях', 'ированный', 'ованный', 'енный', 'анный',
    'ыми', 'ими', 'ых', 'их', 'ого', 'его', 'ому', 'ему', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ый', 'ий', 'ой', 'ей', 'ую', 'юю', 'ом', 'ем', 'ым', 'им',
    'иями', 'ями', 'ами', 'ах', 'ях', 'ов', 'ев', 'ам', 'ям', 'ию', 'ия', 'ие', 'ии', 'ий',
    'ться', 'тся', 'ать', 'ять', 'ить', 'еть', 'уть', 'ет', 'ит', 'ют', 'ут', 'ят', 'ат', 'ла', 'ли', 'ло',
    'а', 'я', 'о', 'е', 'ы', 'и', 'у', 'ю', 'ь', 'й'];

  function normalize(s) { return String(s).toLowerCase().replace(/ё/g, 'е'); }
  function stem(word) {
    const w = normalize(word);
    if (w.length <= 3) return w;
    for (const end of ENDINGS) if (w.length - end.length >= 3 && w.slice(-end.length) === end) return w.slice(0, -end.length);
    return w;
  }
  // Расстояние Дамерау–Левенштейна с ранним выходом
  function distance(a, b, max) {
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    let prev2 = null, prev = [], cur;
    for (let j = 0; j <= lb; j++) prev[j] = j;
    for (let i = 1; i <= la; i++) {
      cur = [i];
      let rowMin = i;
      for (let j = 1; j <= lb; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[lb];
  }
  function cleanTerm(s) { return normalize(s).replace(/[^a-zа-я0-9\s-]/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim(); }
  function stemPhrase(s) { return cleanTerm(s).split(' ').map(stem).join(' '); }
  function termMatches(input, answers) {
    const a = cleanTerm(input);
    if (!a) return false;
    for (const ans of answers) {
      const b = cleanTerm(ans);
      if (a === b || stemPhrase(a) === stemPhrase(b)) return true;
      const max = b.length >= 10 ? 2 : (b.length >= 5 ? 1 : 0);
      if (max && distance(a, b, max) <= max) return true;
    }
    return false;
  }

  window.Text = { rich, inline, source, render, figure, termMatches, normalize };
})();
