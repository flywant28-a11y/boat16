/* =========================================================
   Jaba — маленький язык программирования boat16 («когда скучно»).
   Английские слова, блоки закрываются словом end:

     let name = ask "your name?"
     function greet(who)
       say "hi, {who}!"
     end
     repeat 3 times
       greet(name)
     end

   Что есть: числа, текст (с подстановкой {выражение}), true/false,
   nothing, списки [1, 2] (нумерация с 1, list[-1] — последний),
   объекты {name: "Ann"} (obj.name), if/else if/else, repeat N times,
   repeat forever, while, for each, for i from 1 to 10 step 2,
   функции и return, stop/skip, ask — ввод, встроенные функции (BUILTINS).
   Порядок работы: lex → parse (дерево) → run (асинхронно: ask и wait
   ждут, а длинный цикл не вешает страницу и останавливается кнопкой stop).
   Ошибки — понятным английским с номером строки и подсказкой.
   Файлы — Store 'jaba:files' { 'имя.jaba': код }; примеры и уроки — здесь же.
   ========================================================= */
(function () {
  'use strict';

  const KEYWORDS = ['let', 'if', 'then', 'else', 'end', 'repeat', 'times', 'forever', 'while', 'do', 'for', 'each', 'in',
    'from', 'to', 'step', 'function', 'return', 'stop', 'skip', 'and', 'or', 'not', 'is', 'true', 'false', 'nothing', 'say', 'print', 'ask'];
  const KW = new Set(KEYWORDS);
  const OPENERS = /^\s*(if|else|repeat|while|for|function)\b/;

  class JabaError extends Error { constructor(msg, line) { super(msg); this.line = line; } }
  class Signal { constructor(kind, value) { this.kind = kind; this.value = value; } }

  function fail(msg, line) { throw new JabaError(msg, line); }

  /* =========================================================
     Лексер
     ========================================================= */
  const LETTER = /[\p{L}_]/u, WORD = /[\p{L}\p{N}_]/u;
  const TWO = ['==', '!=', '<=', '>=', '+=', '-=', '*=', '/='];
  const ONE = '+-*/%^()[]{},.:=<>';

  function lex(src, startLine) {
    const toks = [];
    let i = 0, line = startLine || 1;
    const n = src.length;
    function push(type, value, extra) { const t = { type, value, line }; if (extra) Object.assign(t, extra); toks.push(t); }
    while (i < n) {
      const c = src[i];
      if (c === '\n') { push('nl'); line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        let j = i;
        while (j < n && /[0-9_]/.test(src[j])) j++;
        if (src[j] === '.' && /[0-9]/.test(src[j + 1] || '')) { j++; while (j < n && /[0-9]/.test(src[j])) j++; }
        push('num', parseFloat(src.slice(i, j).replace(/_/g, '')));
        i = j;
        continue;
      }
      if (c === '"' || c === "'") {
        const q = c, startL = line;
        const parts = [];
        let buf = '';
        i++;
        for (;;) {
          if (i >= n || src[i] === '\n') fail('this text is missing its closing ' + q + ' quote', startL);
          const d = src[i];
          if (d === q) { i++; break; }
          if (d === '\\') {
            const e = src[i + 1];
            buf += e === 'n' ? '\n' : e === 't' ? '\t' : e === undefined ? '' : e;
            i += 2;
            continue;
          }
          if (d === '{') {
            let depth = 1, j = i + 1;
            while (j < n && depth && src[j] !== '\n') { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
            if (depth) fail('a { inside text needs a closing } — or write \\{ for a plain brace', startL);
            if (buf) parts.push(buf);
            buf = '';
            parts.push({ code: src.slice(i + 1, j - 1), line: startL });
            i = j;
            continue;
          }
          buf += d;
          i++;
        }
        if (buf || !parts.length) parts.push(buf);
        push('str', parts);
        continue;
      }
      if (LETTER.test(c)) {
        let j = i + 1;
        while (j < n && WORD.test(src[j])) j++;
        const w = src.slice(i, j);
        push(KW.has(w) ? 'kw' : 'ident', w);
        i = j;
        continue;
      }
      const two = src.substr(i, 2);
      if (TWO.indexOf(two) !== -1) { push('op', two); i += 2; continue; }
      if (ONE.indexOf(c) !== -1) { push('op', c); i++; continue; }
      fail('I don\'t understand the symbol “' + c + '”', line);
    }
    push('nl');
    push('eof');
    return toks;
  }

  /* =========================================================
     Парсер: токены → дерево
     ========================================================= */
  function parse(src) {
    return new Parser(lex(src, 1)).program();
  }

  function Parser(toks) { this.t = toks; this.p = 0; }
  Parser.prototype = {
    peek: function (k) { return this.t[this.p + (k || 0)]; },
    next: function () { return this.t[this.p++]; },
    is: function (type, value) { const t = this.peek(); return t.type === type && (value === undefined || t.value === value); },
    kw: function (v) { return this.is('kw', v); },
    op: function (v) { return this.is('op', v); },
    accept: function (type, value) { if (this.is(type, value)) return this.next(); return null; },
    expect: function (type, value, what) {
      if (this.is(type, value)) return this.next();
      const t = this.peek();
      fail('expected ' + (what || '“' + value + '”') + ', but found ' + describe(t), t.line);
    },
    skipNl: function () { while (this.is('nl')) this.next(); },
    atEnd: function () { return this.is('nl') || this.is('eof') || this.kw('end') || this.kw('else'); },

    program: function () {
      const body = [];
      this.skipNl();
      while (!this.is('eof')) {
        if (this.kw('end')) fail('this “end” doesn\'t close anything — there is no if, repeat, while, for or function open here', this.peek().line);
        if (this.kw('else')) fail('“else” must be inside an “if … end” block', this.peek().line);
        body.push(this.statement());
        this.endStatement();
        this.skipNl();
      }
      return body;
    },

    // Тело блока до одного из слов-окончаний (само слово не съедаем)
    block: function (enders, opener) {
      const body = [];
      this.skipNl();
      while (!enders.some(function (e) { return this.kw(e); }, this)) {
        if (this.is('eof')) fail('“' + opener.word + '” from line ' + opener.line + ' needs an “end”', opener.line);
        body.push(this.statement());
        this.endStatement();
        this.skipNl();
      }
      return body;
    },

    endStatement: function () {
      if (this.accept('nl') || this.is('eof') || this.kw('end') || this.kw('else')) return;
      const t = this.peek();
      if (t.type === 'op' && t.value === '=') fail('to compare, write “is” or “==” — a single = changes a variable', t.line);
      fail('I didn\'t expect ' + describe(t) + ' here — start a new line for the next command', t.line);
    },

    statement: function () {
      const t = this.peek(), line = t.line;
      if (t.type === 'kw') {
        switch (t.value) {
          case 'let': {
            this.next();
            const name = this.expect('ident', undefined, 'a variable name after “let”').value;
            this.expect('op', '=', '“=” after the variable name');
            return { type: 'Let', name, value: this.expr(), line };
          }
          case 'say': case 'print': {
            this.next();
            const args = [];
            if (!this.atEnd()) { do { args.push(this.expr()); } while (this.accept('op', ',')); }
            return { type: 'Say', args, line };
          }
          case 'if': return this.ifStatement();
          case 'repeat': {
            this.next();
            if (this.accept('kw', 'forever')) {
              const body = this.block(['end'], { word: 'repeat', line });
              this.next();
              return { type: 'Repeat', count: null, body, line };
            }
            if (this.atEnd()) fail('write how many times: “repeat 3 times” or “repeat forever”', line);
            const count = this.expr();
            this.accept('kw', 'times');
            const body = this.block(['end'], { word: 'repeat', line });
            this.next();
            return { type: 'Repeat', count, body, line };
          }
          case 'while': {
            this.next();
            const cond = this.condition();
            this.accept('kw', 'do');
            const body = this.block(['end'], { word: 'while', line });
            this.next();
            return { type: 'While', cond, body, line };
          }
          case 'for': {
            this.next();
            if (this.accept('kw', 'each')) {
              const name = this.expect('ident', undefined, 'a name after “for each”').value;
              this.expect('kw', 'in', '“in”, like: for each item in list');
              const list = this.expr();
              const body = this.block(['end'], { word: 'for', line });
              this.next();
              return { type: 'ForEach', name, list, body, line };
            }
            const name = this.expect('ident', undefined, 'a name, like: for i from 1 to 10').value;
            this.expect('kw', 'from', '“from”, like: for i from 1 to 10');
            const from = this.expr();
            this.expect('kw', 'to', '“to”, like: for i from 1 to 10');
            const to = this.expr();
            const step = this.accept('kw', 'step') ? this.expr() : null;
            const body = this.block(['end'], { word: 'for', line });
            this.next();
            return { type: 'ForRange', name, from, to, step, body, line };
          }
          case 'function': {
            this.next();
            const name = this.expect('ident', undefined, 'a function name').value;
            const params = [];
            this.expect('op', '(', '“(” after the function name — even with no inputs: function hello()');
            if (!this.op(')')) { do { params.push(this.expect('ident', undefined, 'an input name').value); } while (this.accept('op', ',')); }
            this.expect('op', ')', '“)”');
            const body = this.block(['end'], { word: 'function', line });
            this.next();
            return { type: 'Function', name, params, body, line };
          }
          case 'return': this.next(); return { type: 'Return', value: this.atEnd() ? null : this.expr(), line };
          case 'stop': this.next(); return { type: 'Stop', line };
          case 'skip': this.next(); return { type: 'Skip', line };
        }
      }
      const e = this.expr();
      const op = this.peek();
      if (op.type === 'op' && ['=', '+=', '-=', '*=', '/='].indexOf(op.value) !== -1) {
        if (['Var', 'Index', 'Member'].indexOf(e.type) === -1) fail('you can only put a value into a variable, a list item or an object field', line);
        this.next();
        return { type: 'Assign', target: e, op: op.value, value: this.expr(), line };
      }
      return { type: 'Expr', expr: e, line };
    },

    condition: function () {
      const c = this.expr();
      if (this.op('=')) fail('to compare, write “is” or “==” — a single = changes a variable', this.peek().line);
      return c;
    },

    ifStatement: function () {
      const line = this.next().line;
      const branches = [];
      let cond = this.condition();
      this.accept('kw', 'then');
      branches.push({ cond, body: this.block(['else', 'end'], { word: 'if', line }) });
      let otherwise = null;
      while (this.accept('kw', 'else')) {
        if (this.accept('kw', 'if')) {
          cond = this.condition();
          this.accept('kw', 'then');
          branches.push({ cond, body: this.block(['else', 'end'], { word: 'if', line }) });
        } else {
          otherwise = this.block(['end'], { word: 'if', line });
          break;
        }
      }
      this.expect('kw', 'end', '“end” to close the “if” from line ' + line);
      return { type: 'If', branches, otherwise, line };
    },

    /* ---------- Выражения ---------- */
    expr: function () { return this.or(); },
    or: function () {
      let l = this.and();
      while (this.kw('or')) { const line = this.next().line; l = { type: 'Logic', op: 'or', l, r: this.and(), line }; }
      return l;
    },
    and: function () {
      let l = this.not();
      while (this.kw('and')) { const line = this.next().line; l = { type: 'Logic', op: 'and', l, r: this.not(), line }; }
      return l;
    },
    not: function () {
      if (this.kw('not')) { const line = this.next().line; return { type: 'Unary', op: 'not', e: this.not(), line }; }
      return this.compare();
    },
    compare: function () {
      let l = this.add();
      for (;;) {
        const t = this.peek();
        if (t.type === 'kw' && t.value === 'is') {
          this.next();
          const neg = !!this.accept('kw', 'not');
          l = { type: 'Bin', op: neg ? '!=' : '==', l, r: this.add(), line: t.line };
        } else if (t.type === 'op' && ['==', '!=', '<', '>', '<=', '>='].indexOf(t.value) !== -1) {
          this.next();
          l = { type: 'Bin', op: t.value, l, r: this.add(), line: t.line };
        } else return l;
      }
    },
    add: function () {
      let l = this.mul();
      while (this.op('+') || this.op('-')) { const t = this.next(); l = { type: 'Bin', op: t.value, l, r: this.mul(), line: t.line }; }
      return l;
    },
    mul: function () {
      let l = this.unary();
      while (this.op('*') || this.op('/') || this.op('%')) { const t = this.next(); l = { type: 'Bin', op: t.value, l, r: this.unary(), line: t.line }; }
      return l;
    },
    unary: function () {
      if (this.op('-')) { const line = this.next().line; return { type: 'Unary', op: '-', e: this.unary(), line }; }
      if (this.op('+')) { this.next(); return this.unary(); }
      return this.power();
    },
    power: function () {
      const base = this.postfix();
      if (this.op('^')) { const line = this.next().line; return { type: 'Bin', op: '^', l: base, r: this.unary(), line }; }
      return base;
    },
    postfix: function () {
      let e = this.primary();
      for (;;) {
        const t = this.peek();
        if (t.type === 'op' && t.value === '(') {
          this.next();
          const args = this.items(')');
          e = { type: 'Call', fn: e, args, line: t.line };
        } else if (t.type === 'op' && t.value === '[') {
          this.next();
          this.skipNl();
          const index = this.expr();
          this.skipNl();
          this.expect('op', ']', '“]”');
          e = { type: 'Index', obj: e, index, line: t.line };
        } else if (t.type === 'op' && t.value === '.') {
          this.next();
          const name = this.peek();
          if (name.type !== 'ident' && name.type !== 'kw') fail('expected a field name after “.”', t.line);
          this.next();
          e = { type: 'Member', obj: e, name: name.value, line: t.line };
        } else return e;
      }
    },
    // Значения через запятую до закрывающей скобки; переносы строк внутри можно
    items: function (close) {
      const list = [];
      this.skipNl();
      while (!this.op(close)) {
        list.push(this.expr());
        this.skipNl();
        if (!this.accept('op', ',')) break;
        this.skipNl();
      }
      this.skipNl();
      this.expect('op', close, '“' + close + '”');
      return list;
    },
    primary: function () {
      const t = this.peek(), line = t.line;
      if (t.type === 'num') { this.next(); return { type: 'Lit', value: t.value, line }; }
      if (t.type === 'str') {
        this.next();
        if (t.value.length === 1 && typeof t.value[0] === 'string') return { type: 'Lit', value: t.value[0], line };
        return { type: 'Text', parts: t.value.map(function (p) { return typeof p === 'string' ? p : subExpr(p.code, p.line); }), line };
      }
      if (t.type === 'kw') {
        if (t.value === 'true') { this.next(); return { type: 'Lit', value: true, line }; }
        if (t.value === 'false') { this.next(); return { type: 'Lit', value: false, line }; }
        if (t.value === 'nothing') { this.next(); return { type: 'Lit', value: null, line }; }
        if (t.value === 'ask') {
          this.next();
          return { type: 'Ask', q: this.atEnd() || this.op(')') || this.op(',') ? null : this.expr(), line };
        }
        fail('“' + t.value + '” is a Jaba word and can\'t be used here' + (t.value === 'end' ? ' — maybe an extra “end”?' : ''), line);
      }
      if (t.type === 'ident') { this.next(); return { type: 'Var', name: t.value, line }; }
      if (t.type === 'op' && t.value === '(') {
        this.next();
        this.skipNl();
        const e = this.expr();
        this.skipNl();
        this.expect('op', ')', '“)”');
        return e;
      }
      if (t.type === 'op' && t.value === '[') { this.next(); return { type: 'List', items: this.items(']'), line }; }
      if (t.type === 'op' && t.value === '{') {
        this.next();
        const fields = [];
        this.skipNl();
        while (!this.op('}')) {
          const k = this.next();
          if (k.type !== 'ident' && k.type !== 'kw' && !(k.type === 'str' && typeof k.value[0] === 'string')) fail('expected a field name, like {name: "Ann"}', k.line);
          this.expect('op', ':', '“:” after the field name');
          fields.push({ key: k.type === 'str' ? k.value.join('') : k.value, value: this.expr() });
          this.skipNl();
          if (!this.accept('op', ',')) break;
          this.skipNl();
        }
        this.expect('op', '}', '“}”');
        return { type: 'Object', fields, line };
      }
      fail('expected a value here, but found ' + describe(t), line);
    }
  };

  function subExpr(code, line) {
    const p = new Parser(lex(code, line));
    p.skipNl();
    const e = p.expr();
    p.skipNl();
    if (!p.is('eof')) fail('something is wrong inside {' + code + '} in this text', line);
    return e;
  }

  function describe(t) {
    if (t.type === 'nl') return 'the end of the line';
    if (t.type === 'eof') return 'the end of the program';
    if (t.type === 'str') return 'a text';
    if (t.type === 'num') return 'the number ' + t.value;
    return '“' + t.value + '”';
  }

  /* =========================================================
     Значения
     ========================================================= */
  function typeOf(v) {
    if (v === null || v === undefined) return 'nothing';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'string') return 'text';
    if (typeof v === 'boolean') return 'true/false';
    if (Array.isArray(v)) return 'list';
    if (v instanceof Map) return 'object';
    return 'function';
  }

  function num(v) {
    if (Number.isInteger(v)) return String(v);
    if (!isFinite(v)) return isNaN(v) ? 'not a number' : (v > 0 ? 'infinity' : '-infinity');
    return String(parseFloat(v.toPrecision(12)));
  }

  function show(v, nested) {
    if (v === null || v === undefined) return 'nothing';
    if (typeof v === 'number') return num(v);
    if (typeof v === 'string') return nested ? '"' + v + '"' : v;
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (Array.isArray(v)) return '[' + v.map(function (x) { return show(x, true); }).join(', ') + ']';
    if (v instanceof Map) {
      const parts = [];
      v.forEach(function (val, k) { parts.push(k + ': ' + show(val, true)); });
      return '{' + parts.join(', ') + '}';
    }
    return 'function ' + (v.jname || v.name || '');
  }

  function truthy(v) {
    if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v instanceof Map) return v.size > 0;
    return true;
  }

  function equal(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every(function (x, i) { return equal(x, b[i]); });
    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      let same = true;
      a.forEach(function (v, k) { if (!b.has(k) || !equal(v, b.get(k))) same = false; });
      return same;
    }
    if (a === undefined) a = null;
    if (b === undefined) b = null;
    return a === b;
  }

  /* =========================================================
     Окружение переменных
     ========================================================= */
  function Env(parent) { this.vars = new Map(); this.parent = parent; }
  Env.prototype = {
    find: function (name) { let e = this; while (e) { if (e.vars.has(name)) return e; e = e.parent; } return null; },
    get: function (name, line) {
      const e = this.find(name);
      if (e) return e.vars.get(name);
      fail('I don\'t know what “' + name + '” is' + hint(name, this), line);
    },
    set: function (name, v) { (this.find(name) || this).vars.set(name, v); },
    define: function (name, v) { this.vars.set(name, v); },
    names: function () { const out = []; let e = this; while (e) { e.vars.forEach(function (_, k) { out.push(k); }); e = e.parent; } return out; }
  };

  // Подсказки для привычек из других языков и опечаток
  const HABITS = {
    len: 'length', input: 'ask', str: 'text', int: 'number', float: 'number', append: 'add', push: 'add',
    def: 'function', elif: 'else if', var: 'let', const: 'let', echo: 'say', println: 'say', console: 'say',
    True: 'true', False: 'false', null: 'nothing', None: 'nothing', undefined: 'nothing', break: 'stop', continue: 'skip'
  };
  function lev(a, b) {
    const m = [];
    for (let i = 0; i <= a.length; i++) m[i] = [i];
    for (let j = 0; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return m[a.length][b.length];
  }
  function hint(name, env) {
    if (HABITS[name]) return '. In Jaba it\'s “' + HABITS[name] + '”.';
    let best = null, d = 3;
    env.names().concat(KEYWORDS).forEach(function (k) { const x = lev(name, k); if (x < d) { d = x; best = k; } });
    if (best) return '. Did you mean “' + best + '”?';
    return ' — create it first, for example: let ' + name + ' = 0';
  }

  /* =========================================================
     Встроенные функции
     ========================================================= */
  function need(v, type, fn, what) {
    if (typeOf(v) !== type) fail(fn + '() needs ' + (what || 'a ' + type) + ', but got ' + (typeOf(v) === 'text' ? 'the text "' + v + '"' : typeOf(v) === 'nothing' ? 'nothing' : 'a ' + typeOf(v)));
    return v;
  }
  function listOrText(v, fn) {
    if (!Array.isArray(v) && typeof v !== 'string') fail(fn + '() needs a list or a text, but got ' + typeOf(v));
    return v;
  }
  function toNumber(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && /^\s*-?\d+([.,]\d+)?\s*$/.test(v)) return parseFloat(v.replace(',', '.'));
    return null;
  }

  const BUILTINS = {
    length: [1, 1, 'how many items in a list or letters in a text', function (x) {
      if (x instanceof Map) return x.size;
      return listOrText(x, 'length').length;
    }],
    text: [1, 1, 'turn anything into text', function (x) { return show(x); }],
    number: [1, 1, 'turn text like "42" into a number (nothing if it isn\'t a number)', function (x) { return toNumber(x); }],
    type: [1, 1, 'what kind of value it is: number, text, list, object…', function (x) { return typeOf(x); }],
    upper: [1, 1, 'TEXT IN CAPITALS', function (s) { return need(s, 'text', 'upper').toUpperCase(); }],
    lower: [1, 1, 'text in small letters', function (s) { return need(s, 'text', 'lower').toLowerCase(); }],
    trim: [1, 1, 'remove spaces at both ends', function (s) { return need(s, 'text', 'trim').trim(); }],
    split: [1, 2, 'cut text into a list: split("a b c", " ")', function (s, sep) { need(s, 'text', 'split'); return sep === undefined ? s.split(/\s+/).filter(Boolean) : s.split(need(sep, 'text', 'split')); }],
    join: [1, 2, 'glue a list into text: join(list, ", ")', function (l, sep) { return need(l, 'list', 'join').map(function (x) { return show(x); }).join(sep === undefined ? '' : show(sep)); }],
    replace: [3, 3, 'replace(text, "old", "new") — every match', function (s, a, b) { return need(s, 'text', 'replace').split(show(a)).join(show(b)); }],
    contains: [2, 2, 'is the item in the list, or the piece in the text?', function (x, y) {
      if (typeof x === 'string') return x.indexOf(show(y)) !== -1;
      if (x instanceof Map) return x.has(show(y));
      return need(x, 'list', 'contains', 'a list or a text').some(function (v) { return equal(v, y); });
    }],
    part: [2, 3, 'a piece: part(list or text, from, to) — positions start at 1', function (x, a, b) {
      listOrText(x, 'part');
      need(a, 'number', 'part', 'a number for “from”');
      const from = a < 0 ? x.length + a : a - 1;
      const to = b === undefined ? x.length : (need(b, 'number', 'part', 'a number for “to”') < 0 ? x.length + b + 1 : b);
      return x.slice(Math.max(0, from), to);
    }],
    add: [2, 2, 'put an item at the end of a list: add(list, item)', function (l, x) { need(l, 'list', 'add').push(x); return l; }],
    insert: [3, 3, 'insert(list, position, item)', function (l, i, x) { need(l, 'list', 'insert'); need(i, 'number', 'insert', 'a position number'); l.splice(Math.max(0, i - 1), 0, x); return l; }],
    remove: [2, 2, 'remove(list, position) — gives back the removed item', function (l, i) {
      need(l, 'list', 'remove');
      need(i, 'number', 'remove', 'a position number');
      const k = i < 0 ? l.length + i : i - 1;
      if (k < 0 || k >= l.length) fail('remove(): the list has ' + l.length + ' ' + UI.plural(l.length, ['item', 'items']) + ', there is no item ' + i);
      return l.splice(k, 1)[0];
    }],
    find: [2, 2, 'position of an item in a list or text (0 if not there)', function (x, y) {
      if (typeof x === 'string') return x.indexOf(show(y)) + 1;
      const l = need(x, 'list', 'find', 'a list or a text');
      for (let i = 0; i < l.length; i++) if (equal(l[i], y)) return i + 1;
      return 0;
    }],
    sort: [1, 1, 'a sorted copy of a list', function (l) {
      return need(l, 'list', 'sort').slice().sort(function (a, b) {
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return show(a).localeCompare(show(b));
      });
    }],
    reverse: [1, 1, 'a reversed copy of a list or text', function (x) { return Array.isArray(x) ? x.slice().reverse() : Array.from(listOrText(x, 'reverse')).reverse().join(''); }],
    shuffle: [1, 1, 'a shuffled copy of a list', function (l) { return UI.shuffle(need(l, 'list', 'shuffle')); }],
    range: [2, 3, 'list of numbers: range(1, 5) is [1, 2, 3, 4, 5]', function (a, b, s) {
      need(a, 'number', 'range'); need(b, 'number', 'range');
      const step = s === undefined ? (a <= b ? 1 : -1) : need(s, 'number', 'range');
      if (!step) fail('range(): the step can\'t be 0');
      const out = [];
      for (let x = a; step > 0 ? x <= b : x >= b; x += step) { out.push(x); if (out.length > 100000) fail('range(): that\'s too many numbers'); }
      return out;
    }],
    keys: [1, 1, 'list of field names of an object', function (o) { return Array.from(need(o, 'object', 'keys', 'an object').keys()); }],
    sum: [1, 1, 'add up a list of numbers', function (l) { return need(l, 'list', 'sum').reduce(function (a, x) { return a + need(x, 'number', 'sum', 'a list of numbers'); }, 0); }],
    average: [1, 1, 'the average of a list of numbers', function (l) { need(l, 'list', 'average'); if (!l.length) return null; return BUILTINS.sum[3](l) / l.length; }],
    min: [1, 99, 'the smallest: min(3, 1, 2) or min(list)', function () { const a = flat(arguments, 'min'); return a.length ? Math.min.apply(null, a) : null; }],
    max: [1, 99, 'the biggest: max(3, 1, 2) or max(list)', function () { const a = flat(arguments, 'max'); return a.length ? Math.max.apply(null, a) : null; }],
    round: [1, 2, 'round(3.14159, 2) is 3.14', function (x, d) { need(x, 'number', 'round'); const k = Math.pow(10, d || 0); return Math.round(x * k) / k; }],
    floor: [1, 1, 'round down', function (x) { return Math.floor(need(x, 'number', 'floor')); }],
    ceil: [1, 1, 'round up', function (x) { return Math.ceil(need(x, 'number', 'ceil')); }],
    abs: [1, 1, 'distance from zero: abs(-5) is 5', function (x) { return Math.abs(need(x, 'number', 'abs')); }],
    sqrt: [1, 1, 'square root', function (x) { need(x, 'number', 'sqrt'); if (x < 0) fail('sqrt(): no square root of a negative number'); return Math.sqrt(x); }],
    random: [0, 2, 'random(1, 6) — a whole number from 1 to 6; random() — from 0 to 1', function (a, b) {
      if (a === undefined) return Math.random();
      need(a, 'number', 'random');
      if (b === undefined) { b = a; a = 1; }
      need(b, 'number', 'random');
      return Math.floor(Math.random() * (Math.floor(b) - Math.ceil(a) + 1)) + Math.ceil(a);
    }],
    pick: [1, 1, 'a random item from a list', function (l) { need(l, 'list', 'pick'); return l.length ? l[Math.floor(Math.random() * l.length)] : null; }],
    wait: [1, 1, 'pause: wait(1.5) waits 1.5 seconds', function (s) {
      need(s, 'number', 'wait', 'a number of seconds');
      const rt = this;
      return new Promise(function (done) {
        const t = setTimeout(done, Math.min(60, Math.max(0, s)) * 1000);
        rt.timers.push(function () { clearTimeout(t); done(); });
      });
    }],
    now: [0, 0, 'the time now, like "14:05:09"', function () { return new Date().toTimeString().slice(0, 8); }],
    today: [0, 0, 'today\'s date, like "2026-10-26"', function () { return Progress.today(); }],
    clear: [0, 0, 'clean the output', function () { this.host.clear(); return null; }]
  };
  function flat(args, fn) {
    const a = args.length === 1 && Array.isArray(args[0]) ? args[0] : Array.prototype.slice.call(args);
    a.forEach(function (x) { need(x, 'number', fn, 'numbers'); });
    return a;
  }

  /* =========================================================
     Выполнение
     ========================================================= */
  const MAX_DEPTH = 300;

  // Отдать ход странице без задержки setTimeout: длинный цикл не вешает вкладку
  const chan = typeof MessageChannel === 'function' ? new MessageChannel() : null;
  const waiting = [];
  if (chan) chan.port1.onmessage = function () { const f = waiting.shift(); if (f) f(); };
  function breathe() {
    return new Promise(function (r) { if (chan) { waiting.push(r); chan.port2.postMessage(0); } else setTimeout(r, 0); });
  }

  function Runtime(host) {
    this.host = host;
    this.stopped = false;
    this.steps = 0;
    this.depth = 0;
    this.line = 1;
    this.timers = [];
    this.lastBreath = performance.now();
  }

  Runtime.prototype = {
    tick: async function () {
      if (this.stopped) throw new Signal('halt');
      if (++this.steps % 200 === 0 && performance.now() - this.lastBreath > 12) {
        await breathe();
        this.lastBreath = performance.now();
        if (this.stopped) throw new Signal('halt');
      }
    },

    block: async function (body, env) {
      for (let i = 0; i < body.length; i++) await this.exec(body[i], env);
    },

    // Тело цикла: stop — выйти, skip — к следующему кругу
    loopBody: async function (body, env) {
      try { await this.block(body, env); }
      catch (s) {
        if (s instanceof Signal && s.kind === 'stop') return 'stop';
        if (s instanceof Signal && s.kind === 'skip') return 'skip';
        throw s;
      }
      return null;
    },

    exec: async function (n, env) {
      this.line = n.line;
      await this.tick();
      switch (n.type) {
        case 'Let': env.define(n.name, await this.eval(n.value, env)); return;
        case 'Say': {
          const vals = [];
          for (let i = 0; i < n.args.length; i++) vals.push(show(await this.eval(n.args[i], env)));
          this.host.print(vals.join(' '));
          return;
        }
        case 'If':
          for (let i = 0; i < n.branches.length; i++) {
            if (truthy(await this.eval(n.branches[i].cond, env))) { await this.block(n.branches[i].body, env); return; }
          }
          if (n.otherwise) await this.block(n.otherwise, env);
          return;
        case 'Repeat': {
          let count = Infinity;
          if (n.count) {
            count = await this.eval(n.count, env);
            this.line = n.line;
            if (typeof count !== 'number') fail('repeat needs a number of times, but got ' + typeOf(count), n.line);
          }
          for (let i = 0; i < count; i++) {
            if (await this.loopBody(n.body, env) === 'stop') break;
            await this.tick();
          }
          return;
        }
        case 'While':
          while (truthy(await this.eval(n.cond, env))) {
            if (await this.loopBody(n.body, env) === 'stop') break;
            await this.tick();
          }
          return;
        case 'ForEach': {
          let list = await this.eval(n.list, env);
          if (typeof list === 'string') list = Array.from(list);
          else if (list instanceof Map) list = Array.from(list.keys());
          else if (!Array.isArray(list)) fail('“for each” needs a list, a text or an object, but got ' + typeOf(list), n.line);
          const items = list.slice();
          for (let i = 0; i < items.length; i++) {
            env.set(n.name, items[i]);
            if (await this.loopBody(n.body, env) === 'stop') break;
            await this.tick();
          }
          return;
        }
        case 'ForRange': {
          const a = await this.eval(n.from, env), b = await this.eval(n.to, env);
          if (typeof a !== 'number' || typeof b !== 'number') fail('“for … from … to …” needs numbers', n.line);
          const step = n.step ? await this.eval(n.step, env) : (a <= b ? 1 : -1);
          if (typeof step !== 'number' || !step) fail('the step must be a number that isn\'t 0', n.line);
          for (let x = a; step > 0 ? x <= b + 1e-9 : x >= b - 1e-9; x += step) {
            env.set(n.name, Math.round(x * 1e9) / 1e9);
            if (await this.loopBody(n.body, env) === 'stop') break;
            await this.tick();
          }
          return;
        }
        case 'Function': env.define(n.name, { name: n.name, params: n.params, body: n.body, closure: env }); return;
        case 'Return': throw new Signal('return', n.value ? await this.eval(n.value, env) : null);
        case 'Stop': throw new Signal('stop');
        case 'Skip': throw new Signal('skip');
        case 'Assign': {
          let v = await this.eval(n.value, env);
          if (n.op !== '=') v = this.bin(n.op[0], await this.eval(n.target, env), v, n.line);
          await this.store(n.target, v, env);
          return;
        }
        case 'Expr': await this.eval(n.expr, env); return;
      }
    },

    store: async function (t, v, env) {
      if (t.type === 'Var') { env.set(t.name, v); return; }
      const obj = await this.eval(t.obj, env);
      if (t.type === 'Member') {
        if (!(obj instanceof Map)) fail('only objects have fields — this is ' + typeOf(obj), t.line);
        obj.set(t.name, v);
        return;
      }
      const key = await this.eval(t.index, env);
      if (obj instanceof Map) { obj.set(show(key), v); return; }
      if (typeof obj === 'string') fail('you can\'t change one letter inside a text — build a new text instead', t.line);
      if (!Array.isArray(obj)) fail('you can only use [ ] on a list, a text or an object — this is ' + typeOf(obj), t.line);
      if (typeof key !== 'number' || !Number.isInteger(key)) fail('a list position must be a whole number, like list[1]', t.line);
      const k = key < 0 ? obj.length + key : key - 1;
      if (k === obj.length) { obj.push(v); return; }
      if (k < 0 || k > obj.length) fail('the list has ' + obj.length + ' ' + UI.plural(obj.length, ['item', 'items']) + ' — there is no item ' + key + ' (the first one is 1)', t.line);
      obj[k] = v;
    },

    eval: async function (n, env) {
      switch (n.type) {
        case 'Lit': return n.value;
        case 'Text': {
          let s = '';
          for (let i = 0; i < n.parts.length; i++) s += typeof n.parts[i] === 'string' ? n.parts[i] : show(await this.eval(n.parts[i], env));
          return s;
        }
        case 'Var': return env.get(n.name, n.line);
        case 'List': {
          const out = [];
          for (let i = 0; i < n.items.length; i++) out.push(await this.eval(n.items[i], env));
          return out;
        }
        case 'Object': {
          const m = new Map();
          for (let i = 0; i < n.fields.length; i++) m.set(n.fields[i].key, await this.eval(n.fields[i].value, env));
          return m;
        }
        case 'Unary': {
          const v = await this.eval(n.e, env);
          if (n.op === 'not') return !truthy(v);
          if (typeof v !== 'number') fail('you can\'t put a minus before ' + typeOf(v), n.line);
          return -v;
        }
        case 'Logic': {
          const l = truthy(await this.eval(n.l, env));
          if (n.op === 'and') return l ? truthy(await this.eval(n.r, env)) : false;
          return l ? true : truthy(await this.eval(n.r, env));
        }
        case 'Bin': return this.bin(n.op, await this.eval(n.l, env), await this.eval(n.r, env), n.line);
        case 'Call': {
          const fn = await this.eval(n.fn, env);
          const args = [];
          for (let i = 0; i < n.args.length; i++) args.push(await this.eval(n.args[i], env));
          this.line = n.line;
          return this.call(fn, args, n);
        }
        case 'Index': {
          const obj = await this.eval(n.obj, env), key = await this.eval(n.index, env);
          if (obj instanceof Map) return obj.has(show(key)) ? obj.get(show(key)) : null;
          if (!Array.isArray(obj) && typeof obj !== 'string') fail('you can only use [ ] on a list, a text or an object — this is ' + typeOf(obj), n.line);
          if (typeof key !== 'number' || !Number.isInteger(key)) fail('a position must be a whole number, like list[1]', n.line);
          const k = key < 0 ? obj.length + key : key - 1;
          if (k < 0 || k >= obj.length) {
            const what = typeof obj === 'string' ? ['letter', 'letters'] : ['item', 'items'];
            fail('there ' + (obj.length === 1 ? 'is ' : 'are ') + obj.length + ' ' + UI.plural(obj.length, what) + ' — there is no number ' + key + (key === 0 ? ' (in Jaba the first one is 1)' : ''), n.line);
          }
          return obj[k];
        }
        case 'Member': {
          const obj = await this.eval(n.obj, env);
          if (obj instanceof Map) return obj.has(n.name) ? obj.get(n.name) : null;
          if ((Array.isArray(obj) || typeof obj === 'string') && n.name === 'length') return obj.length;
          fail('“.' + n.name + '” works only on objects — this is ' + typeOf(obj), n.line);
        }
        case 'Ask': {
          const q = n.q ? show(await this.eval(n.q, env)) : '';
          const answer = await this.host.ask(q);
          if (this.stopped) throw new Signal('halt');
          const asNum = toNumber(answer);
          return asNum === null ? answer : asNum;
        }
      }
      fail('I can\'t work out this part', n.line);
    },

    call: async function (fn, args, n) {
      if (typeof fn === 'function') {
        const spec = fn.spec;
        if (args.length < spec[0] || args.length > spec[1]) {
          fail(fn.jname + '() needs ' + (spec[0] === spec[1] ? spec[0] : spec[0] + ' to ' + spec[1]) + ' ' + UI.plural(spec[1], ['value', 'values']) + ', but got ' + args.length, n.line);
        }
        try { return await fn.apply(this, args); }
        catch (e) { if (e instanceof JabaError && !e.line) e.line = n.line; throw e; }
      }
      if (!fn || !fn.params) fail('this is ' + typeOf(fn) + ', not a function — only functions can be called with ( )', n.line);
      if (args.length !== fn.params.length) {
        fail(fn.name + '() needs ' + fn.params.length + ' ' + UI.plural(fn.params.length, ['value', 'values']) + (fn.params.length ? ' (' + fn.params.join(', ') + ')' : '') + ', but got ' + args.length, n.line);
      }
      if (++this.depth > MAX_DEPTH) fail(fn.name + '() calls itself too many times — check when it should stop', n.line);
      const local = new Env(fn.closure);
      fn.params.forEach(function (p, i) { local.define(p, args[i]); });
      try { await this.block(fn.body, local); }
      catch (s) {
        if (s instanceof Signal && s.kind === 'return') return s.value;
        if (s instanceof Signal && (s.kind === 'stop' || s.kind === 'skip')) fail('“' + s.kind + '” works only inside a loop', this.line);
        throw s;
      }
      finally { this.depth--; }
      return null;
    },

    bin: function (op, l, r, line) {
      switch (op) {
        case '+':
          if (typeof l === 'string' || typeof r === 'string') return show(l) + show(r);
          if (Array.isArray(l) && Array.isArray(r)) return l.concat(r);
          if (typeof l === 'number' && typeof r === 'number') return l + r;
          return fail('you can\'t add ' + typeOf(r) + ' to ' + typeOf(l), line);
        case '-': case '/': case '%': case '^':
          if (typeof l !== 'number' || typeof r !== 'number') fail('“' + op + '” works with numbers, but got ' + typeOf(l) + ' and ' + typeOf(r) + (typeof l === 'string' || typeof r === 'string' ? ' — use number() to turn text into a number' : ''), line);
          if ((op === '/' || op === '%') && r === 0) fail('you can\'t divide by zero', line);
          return op === '-' ? l - r : op === '/' ? l / r : op === '%' ? l % r : Math.pow(l, r);
        case '*':
          if (typeof l === 'string' && typeof r === 'number') return l.repeat(Math.max(0, Math.floor(r)));
          if (typeof l === 'number' && typeof r === 'string') return r.repeat(Math.max(0, Math.floor(l)));
          if (typeof l !== 'number' || typeof r !== 'number') fail('“*” works with numbers, but got ' + typeOf(l) + ' and ' + typeOf(r), line);
          return l * r;
        case '==': return equal(l, r);
        case '!=': return !equal(l, r);
        default: {
          if (typeof l === 'number' && typeof r === 'number') return op === '<' ? l < r : op === '>' ? l > r : op === '<=' ? l <= r : l >= r;
          if (typeof l === 'string' && typeof r === 'string') {
            const c = l.localeCompare(r);
            return op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
          }
          return fail('you can\'t compare ' + typeOf(l) + ' with ' + typeOf(r) + ' using “' + op + '”', line);
        }
      }
    }
  };

  /* Запуск. host = { print(text), ask(question) → Promise<text>, clear() }.
     Возвращает { stop(), done }: done → { ok, error, line, ms } */
  function run(src, host) {
    const rt = new Runtime(host);
    const started = performance.now();
    const done = (async function () {
      try {
        const program = parse(src);
        const env = new Env(globals());
        await rt.block(program, env);
        return { ok: true, ms: performance.now() - started };
      } catch (e) {
        if (e instanceof Signal) {
          if (e.kind === 'halt') return { ok: false, stopped: true, ms: performance.now() - started };
          const what = e.kind === 'return' ? '“return” works only inside a function' : '“' + e.kind + '” works only inside a loop';
          return { ok: false, error: what, line: rt.line };
        }
        if (e instanceof JabaError) return { ok: false, error: e.message, line: e.line || rt.line };
        if (e instanceof RangeError) return { ok: false, error: 'the program went too deep — a function probably calls itself forever', line: rt.line };
        return { ok: false, error: 'something broke inside Jaba: ' + e.message, line: rt.line };
      }
    })();
    return {
      done,
      stop: function () { rt.stopped = true; rt.timers.forEach(function (f) { f(); }); if (host.cancel) host.cancel(); }
    };
  }

  let base = null;
  function globals() {
    if (base) return base;
    base = new Env(null);
    Object.keys(BUILTINS).forEach(function (k) {
      const b = BUILTINS[k];
      const fn = b[3];
      fn.spec = b;
      fn.jname = k;
      base.define(k, fn);
    });
    return base;
  }

  /* =========================================================
     Подсветка для редактора и cat
     ========================================================= */
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  const TOKEN = /(#[^\n]*)|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(\b\d+(?:\.\d+)?\b)|([\p{L}_][\p{L}\p{N}_]*)|([\s\S])/gu;
  function highlight(src) {
    let out = '';
    src.replace(TOKEN, function (m, com, str, n, word, other) {
      if (com) out += '<span class="jc">' + esc(com) + '</span>';
      else if (str) out += '<span class="js">' + esc(str).replace(/\{[^}\n]*\}/g, function (x) { return '<span class="ji">' + x + '</span>'; }) + '</span>';
      else if (n) out += '<span class="jn">' + n + '</span>';
      else if (word) {
        if (word === 'true' || word === 'false' || word === 'nothing') out += '<span class="jn">' + word + '</span>';
        else if (KW.has(word)) out += '<span class="jk">' + word + '</span>';
        else if (BUILTINS[word]) out += '<span class="jf">' + word + '</span>';
        else out += esc(word);
      } else out += esc(other);
      return m;
    });
    return out;
  }

  /* =========================================================
     Файлы ~/code
     ========================================================= */
  const WELCOME = [
    '# Welcome to Jaba! Press Run (or Ctrl+Enter).',
    '# Lines starting with # are notes — Jaba skips them.',
    '',
    'say "Hello from Jaba!"',
    'let name = ask "What\'s your name?"',
    'say "Nice to meet you, {name}!"',
    '',
    'repeat 3 times',
    '  say "ribbit"',
    'end',
    ''
  ].join('\n');

  const files = {
    all: function () {
      let f = Store.get('jaba:files', null);
      if (!f || typeof f !== 'object') { f = { 'hello.jaba': WELCOME }; Store.set('jaba:files', f); }
      return f;
    },
    list: function () { return Object.keys(files.all()).sort(); },
    read: function (name) {
      if (/^examples\//.test(name)) { const ex = EXAMPLES[name.slice(9)]; return ex === undefined ? null : ex; }
      const f = files.all();
      return Object.prototype.hasOwnProperty.call(f, name) ? f[name] : null;
    },
    write: function (name, code) { const f = files.all(); f[name] = code; Store.set('jaba:files', f); },
    remove: function (name) { const f = files.all(); const had = Object.prototype.hasOwnProperty.call(f, name); delete f[name]; Store.set('jaba:files', f); return had; },
    clean: function (name) {
      name = String(name || '').trim().replace(/^~?\/?(code\/)?/, '').replace(/[^\p{L}\p{N}_.-]+/gu, '-');
      if (!name) return '';
      return /\.jaba$/.test(name) ? name : name + '.jaba';
    },
    // Свободное имя: name.jaba, name-2.jaba…
    free: function (name) {
      const f = files.all();
      if (!f[name]) return name;
      const stem = name.replace(/\.jaba$/, '');
      for (let i = 2; ; i++) if (!f[stem + '-' + i + '.jaba']) return stem + '-' + i + '.jaba';
    }
  };

  /* =========================================================
     Примеры — ~/code/examples (только чтение; правка сохраняет копию)
     ========================================================= */
  const EXAMPLES = {
    'guess.jaba': [
      '# Guess the number from 1 to 100',
      'let secret = random(1, 100)',
      'let tries = 0',
      'say "I picked a number from 1 to 100. Can you guess it?"',
      '',
      'repeat forever',
      '  let guess = ask "your guess:"',
      '  if type(guess) is not "number" then',
      '    say "that\'s not a number — try again"',
      '    skip',
      '  end',
      '  tries += 1',
      '  if guess is secret then',
      '    say "Yes! It was {secret}. You needed {tries} tries."',
      '    stop',
      '  else if guess < secret then',
      '    say "bigger"',
      '  else',
      '    say "smaller"',
      '  end',
      'end',
      ''
    ].join('\n'),
    'quiz.jaba': [
      '# A tiny quiz. Add your own questions to the list!',
      'let questions = [',
      '  {q: "2 + 2 * 2 = ?", a: 6},',
      '  {q: "How many sides does a hexagon have?", a: 6},',
      '  {q: "Capital of Russia?", a: "Moscow"},',
      '  {q: "Square root of 144?", a: 12}',
      ']',
      'let score = 0',
      '',
      'for each item in shuffle(questions)',
      '  let answer = ask item.q',
      '  if lower(text(answer)) is lower(text(item.a)) then',
      '    say "right!"',
      '    score += 1',
      '  else',
      '    say "no — it\'s {item.a}"',
      '  end',
      'end',
      '',
      'say "score: {score} of {length(questions)}"',
      ''
    ].join('\n'),
    'fizzbuzz.jaba': [
      '# FizzBuzz: a classic puzzle for programmers',
      'for n from 1 to 30',
      '  if n % 15 is 0 then',
      '    say "FizzBuzz"',
      '  else if n % 3 is 0 then',
      '    say "Fizz"',
      '  else if n % 5 is 0 then',
      '    say "Buzz"',
      '  else',
      '    say n',
      '  end',
      'end',
      ''
    ].join('\n'),
    'primes.jaba': [
      '# Prime numbers: a function that answers true or false',
      'function is_prime(n)',
      '  if n < 2 then return false end',
      '  if n < 4 then return true end',
      '  for d from 2 to floor(sqrt(n))',
      '    if n % d is 0 then return false end',
      '  end',
      '  return true',
      'end',
      '',
      'let found = []',
      'for n from 1 to 100',
      '  if is_prime(n) then add(found, n) end',
      'end',
      'say "primes up to 100:"',
      'say join(found, ", ")',
      'say "that\'s {length(found)} numbers"',
      ''
    ].join('\n'),
    'shopping.jaba': [
      '# A shopping list you can edit by typing',
      'let list = []',
      'say "Type items to add. Type done to finish, or remove N to delete item N."',
      '',
      'repeat forever',
      '  let item = text(ask "item:")',
      '  if item is "done" then stop end',
      '  if part(item, 1, 7) is "remove " then',
      '    let n = number(part(item, 8))',
      '    if n is nothing or n < 1 or n > length(list) then',
      '      say "there is no item like that"',
      '    else',
      '      say "removed {remove(list, n)}"',
      '    end',
      '  else',
      '    add(list, item)',
      '  end',
      'end',
      '',
      'say "your list:"',
      'for i from 1 to length(list)',
      '  say "{i}. {list[i]}"',
      'end',
      ''
    ].join('\n'),
    'countdown.jaba': [
      '# A countdown with pauses',
      'let start = ask "count down from:"',
      'if type(start) is not "number" then',
      '  say "please type a number next time"',
      'else',
      '  for i from start to 1',
      '    say i',
      '    wait(1)',
      '  end',
      '  say "liftoff! 🚀"',
      'end',
      ''
    ].join('\n'),
    'story.jaba': [
      '# A silly story from your words',
      'let animal = ask "an animal:"',
      'let food = ask "a food:"',
      'let place = ask "a place:"',
      'let plates = random(2, 99)',
      '',
      'say "One day a {animal} walked into {place}."',
      'say "It ate {plates} plates of {food} and fell asleep."',
      'say "The end. " + upper("ribbit!")',
      ''
    ].join('\n'),
    'times.jaba': [
      '# Times table, printed in neat rows',
      'for row from 1 to 9',
      '  let line = []',
      '  for col from 1 to 9',
      '    let cell = text(row * col)',
      '    add(line, " " * (3 - length(cell)) + cell)',
      '  end',
      '  say join(line, "")',
      'end',
      ''
    ].join('\n')
  };

  /* =========================================================
     Уроки
     ========================================================= */
  const LESSONS = [
    {
      title: 'Say something',
      text: '`say` prints whatever comes after it. Text goes in quotes, numbers don\'t. Several values in one line are separated by commas.',
      task: 'Make Jaba say your name on one line and your age on the next.',
      code: 'say "Hello!"\nsay "2 + 3 is", 2 + 3\n'
    },
    {
      title: 'Variables',
      text: 'A variable is a box with a name. `let` creates it, `=` puts a new value in, `+=` adds to it. Inside text, `{name}` shows what\'s in the box.',
      task: 'Make a variable `coins`, add 5 to it three times, then say how many coins you have.',
      code: 'let coins = 10\ncoins += 5\nsay "I have {coins} coins"\n'
    },
    {
      title: 'Asking questions',
      text: '`ask` shows a question and waits for an answer. If the answer looks like a number, Jaba turns it into a number for you.',
      task: 'Ask for two numbers and say their sum.',
      code: 'let age = ask "How old are you?"\nsay "Next year you\'ll be {age + 1}"\n'
    },
    {
      title: 'Decisions',
      text: '`if … then … end` runs lines only when something is true. Compare with `is`, `is not`, `<`, `>`, `<=`, `>=`, and combine with `and`, `or`, `not`. Add `else if` and `else` for other cases.',
      task: 'Ask for a test score and say "5" for 90+, "4" for 70+, "3" for 50+, otherwise "2".',
      code: 'let n = ask "a number:"\nif n > 0 then\n  say "positive"\nelse if n is 0 then\n  say "zero"\nelse\n  say "negative"\nend\n'
    },
    {
      title: 'Loops',
      text: '`repeat 3 times … end` repeats lines. `for i from 1 to 10 … end` counts. `while … end` repeats while something is true. `stop` leaves a loop, `skip` jumps to the next round.',
      task: 'Print the squares of the numbers from 1 to 10.',
      code: 'for i from 1 to 5\n  say "{i} x {i} = {i * i}"\nend\n'
    },
    {
      title: 'Lists',
      text: 'A list keeps many values: `[3, 1, 2]`. The first item is `list[1]`, the last is `list[-1]`. `add(list, x)` puts x at the end, `length(list)` counts, `for each item in list` goes through all of them.',
      task: 'Make a list of your favourite foods, add one more, then print them sorted.',
      code: 'let pets = ["cat", "frog"]\nadd(pets, "dog")\nfor each pet in pets\n  say "I like my {pet}"\nend\nsay "there are {length(pets)} pets"\n'
    },
    {
      title: 'Functions',
      text: 'A function is a recipe you name once and use many times. `function name(inputs) … end` creates it, `return` gives an answer back.',
      task: 'Write a function `area(w, h)` that returns the area of a rectangle and print area(3, 4).',
      code: 'function double(x)\n  return x * 2\nend\nsay double(21)\n'
    },
    {
      title: 'Objects and a project',
      text: 'An object groups named values: `{name: "Ann", age: 15}`. Read a field with a dot: `p.name`. Now you know enough for real programs — open the examples (files → examples) and change them.',
      task: 'Finish the game: open examples/guess.jaba, run it, then make the secret number go up to 1000.',
      code: 'let hero = {name: "Jaba", hp: 10}\nhero.hp -= 3\nsay "{hero.name} has {hero.hp} hp left"\n'
    }
  ];

  window.Jaba = {
    run, parse, highlight, show, files, EXAMPLES, LESSONS, KEYWORDS, OPENERS,
    builtins: function () { return Object.keys(BUILTINS).map(function (k) { return { name: k, about: BUILTINS[k][2] }; }); }
  };
})();
