/* Vernier 运行时语言切换引擎（三个标定页共用）
   用法：
     window.VernierI18n.init({
       tr: function(zhText){ return enText; },   // 词典/规则翻译；未命中返回原串
       titleEn: 'English page title',
       refresh: function(){ 重渲染动态区域（结果页 / HUD / 提示） }
     });
   行为：
   - 首屏按 ?lang= > localStorage cs2at.lang > 浏览器语言决定；
   - #langSw [data-lang] 点击 → LangRipple.run(点击坐标, 切换)（无控件时直接切换）；
   - 切换时静态文本按快照还原/翻译，随后调用 refresh；
   - 写入 localStorage cs2at.lang，同步 <html lang> 与 document.title。
   动态容器请标 data-no-i18n，由各页 refresh() 用 L2() 重渲染。 */
(function () {
  var EN = false, opts = {}, nodes = [], attrs = [], titleZh = '', ready = false;

  function translatePreserve(s) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    if (!m) return s;
    var core = m[2];
    if (!core || !/[\u4e00-\u9fa5]/.test(core)) return s;
    var out;
    try { out = opts.tr ? opts.tr(core) : core; } catch (e) { out = core; }
    return m[1] + (out == null ? core : out) + m[3];
  }

  function collect() {
    var skipTag = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1 };
    var tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = tw.nextNode())) {
      var p = n.parentElement;
      if (!p || skipTag[p.tagName]) continue;
      if (p.closest('#langSw') || p.closest('[data-no-i18n]')) continue;
      if (n.nodeValue && n.nodeValue.trim()) nodes.push({ n: n, zh: n.nodeValue });
    }
    Array.prototype.forEach.call(document.querySelectorAll('[placeholder],[title],[aria-label]'), function (el) {
      if (el.closest('#langSw') || el.closest('[data-no-i18n]')) return;
      ['placeholder', 'title', 'aria-label'].forEach(function (a) {
        if (el.hasAttribute(a)) attrs.push({ el: el, attr: a, zh: el.getAttribute(a) });
      });
    });
    titleZh = document.title;
  }

  function paintStatic() {
    var i, o;
    for (i = 0; i < nodes.length; i++) {
      o = nodes[i];
      if (!o.n || !o.n.parentElement) continue;
      o.n.nodeValue = EN ? translatePreserve(o.zh) : o.zh;
    }
    for (i = 0; i < attrs.length; i++) {
      o = attrs[i];
      o.el.setAttribute(o.attr, EN ? translatePreserve(o.zh) : o.zh);
    }
    try { document.title = EN ? (opts.titleEn || titleZh) : titleZh; } catch (e) {}
    try { document.documentElement.setAttribute('lang', EN ? 'en' : 'zh-CN'); } catch (e) {}
    document.querySelectorAll('#langSw [data-lang]').forEach(function (b) {
      var isEnBtn = b.getAttribute('data-lang') === 'en';
      b.classList.toggle('is-on', isEnBtn === EN);
      try { b.setAttribute('aria-pressed', String(isEnBtn === EN)); } catch (e) {}
    });
    if (typeof opts.refresh === 'function') {
      try { opts.refresh(EN); } catch (e) { if (window.console) console.error(e); }
    }
  }

  function set(en, persist) {
    EN = !!en;
    window.__IS_EN = EN;
    if (persist) { try { localStorage.setItem('cs2at.lang', EN ? 'en' : 'zh'); } catch (e) {} }
    paintStatic();
  }

  function bindButtons() {
    document.querySelectorAll('#langSw [data-lang]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var target = b.getAttribute('data-lang') === 'en';
        if (target === EN) return;
        var run = function () { set(target, true); };
        if (window.LangRipple && window.LangRipple.run) {
          window.LangRipple.run({ x: e.clientX, y: e.clientY }, run);
        } else { run(); }
      });
      b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    });
  }

  function init(o) {
    if (ready) return;
    ready = true;
    opts = o || {};
    var en;
    if (typeof window.__IS_EN === 'boolean') {
      en = window.__IS_EN;   // 页内最早脚本已经按 ?lang= / cs2at.lang / 浏览器语言定过
    } else {
      try {
        var q = new URLSearchParams(location.search);
        if (q.get('lang') === 'en' || q.get('lang') === 'zh') en = q.get('lang') === 'en';
        else {
          var s = localStorage.getItem('cs2at.lang');
          if (s === 'en' || s === 'zh') en = s === 'en';
          else en = (navigator.language || 'en').toLowerCase().indexOf('zh') !== 0;
        }
      } catch (e) { en = true; }
    }
    EN = !!en;
    window.__IS_EN = EN;
    collect();
    bindButtons();
    paintStatic();
  }

  window.VernierI18n = { init: init, set: set, isEn: function () { return EN; } };
})();
