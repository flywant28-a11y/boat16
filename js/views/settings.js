/* =========================================================
   settings — прогресс (экспорт, импорт, в том числе файл со старого
   сайта), сброс, о сайте.
   ========================================================= */
(function () {
  'use strict';

  const el = UI.el, esc = UI.esc;

  function mod(name, meta) {
    const m = el('section', 'mod');
    m.appendChild(el('div', 'mod-head', '<span class="mod-name">' + name + '</span><span class="mod-meta">' + (meta || '') + '</span>'));
    const b = el('div', 'mod-body');
    m.appendChild(b);
    return { m, b };
  }

  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = el('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function render(view) {
    view.classList.add('page');

    /* ---------- Прогресс ---------- */
    const p = mod('progress', Object.keys((Store.get('progress', {}) || {}).topics || {}).length + ' topics recorded');
    p.b.appendChild(el('p', 'muted', 'Progress is stored only in this browser. Save a file to move it to another device or browser. Import also accepts export files from the old «Тетрадь ОГЭ» site.'));
    const row = el('div', 'btn-row');
    row.appendChild(UI.button('btn', '↓ export', function () { download('boat16-progress-' + Progress.today() + '.json', Progress.exportJSON()); }));
    const imp = el('label', 'btn', '↑ import');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.hidden = true;
    input.addEventListener('change', function () {
      const f = input.files[0];
      if (!f) return;
      f.text().then(function (text) {
        if (!confirm('Replace current progress with data from “' + f.name + '”?')) return;
        try {
          const n = Progress.importJSON(text);
          Bank.reload();
          UI.toast('Topics imported: ' + n + '.', { kind: 'ok' });
          window.dispatchEvent(new CustomEvent('progress-changed'));
          App.go('#/courses');
        } catch (e) { UI.toast('Failed: ' + e.message); }
      });
    });
    imp.appendChild(input);
    row.appendChild(imp);
    row.appendChild(UI.button('btn btn-ghost danger', 'reset everything', function () {
      if (!confirm('Delete all progress: studied topics, reviews, minutes and solved tasks?')) return;
      Progress.resetAll();
      Bank.reload();
      UI.toast('Progress has been reset.');
      window.dispatchEvent(new CustomEvent('progress-changed'));
      App.go('#/courses');
    }));
    p.b.appendChild(row);
    view.appendChild(p.m);

    /* ---------- О сайте ---------- */
    const a = mod('about', 'v' + BOAT.version);
    a.b.innerHTML =
      '<p>boat16 — OGE exam prep in social studies and math. Each topic goes <b>video → notes → review → practice</b>, then reviews after 3 and 7 days. Every 15 minutes of practice — an optional quiz on mastered topics.</p>' +
      '<ul class="credits">' +
      '<li>Notes and tasks — materials from the old site: Umschool cheat sheets, the open FIPI task bank.</li>' +
      '<li>Walkthroughs — FIPI demo exams 2026–2027 (fipi.ru).</li>' +
      '<li>Videos — Danir Baev (<a href="' + VIDEO_AUTHORS.math.channel + '" target="_blank" rel="noopener">YouTube</a>) and Ravil Kandinsky (<a href="' + VIDEO_AUTHORS.social.channel + '" target="_blank" rel="noopener">YouTube</a>, <a href="' + MATERIALS.channel + '" target="_blank" rel="noopener">Telegram</a>), Umschool online school.</li>' +
      '<li>Formulas — KaTeX, font — JetBrains Mono (OFL). Wallpapers are drawn in code.</li>' +
      '</ul>';
    view.appendChild(a.m);
  }

  window.SettingsView = { render };
})();
