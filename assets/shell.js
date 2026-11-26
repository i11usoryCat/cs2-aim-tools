/* ============================================================================
   Vernier · 外壳脚本 shell.js（W1）
   ----------------------------------------------------------------------------
   全站唯一的「主题初始化 + 语言状态 + 语言切换接线 + 抖动层插入」实现。
   在 <head> 里同步引入，先于样式表生效（避免主题 / 语言闪烁）。

   页面约定（外壳 API）：
     <html data-default="zh|en">                    双语文章页的文件标称语言
     <html data-title-zh="…" data-title-en="…">     语言切换时同步 document.title
     <html data-theme="…">                          无 JS 兜底主题（JS 会立刻覆盖）
     .langsw / .langTop 容器 + [data-l] / [data-lang]（值 zh / en）语言开关
     <article data-lang="zh|en">                    双语同页：按语言显隐

   页面接口：
     VernierShell.i18n.register(EN)   单页双语（落地页）：注册英文词典，自动反推中文
     VernierShell.lang.apply(lang)    立即应用语言（不写存储，供 QA / 页面调用）
     VernierShell.lang.set(lang)      用户切换：应用 + 写存储 + 同步 URL

   主题口径：?theme= > 用户手动锁定（cs2at.themeUser=1 → cs2at.theme）>
             本地时间自动（06:30–18:30 明亮 sand，其余 forest）
   ========================================================================== */
(function () {
  'use strict';

  var D = document.documentElement;
  var VERSION = '1';
  var THEMES = { sand:1, ink:1, lake:1, light:1, jade:1, forest:1, mono:1, night:1, cyber:1 };

  function qs(k){ try{ return new URLSearchParams(location.search).get(k); }catch(e){ return null; } }
  function getLS(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function setLS(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }

  /* ── 1 · 主题 ─────────────────────────────────────────────────────────── */
  function autoTheme(){
    var d = new Date(); var m = d.getHours()*60 + d.getMinutes();
    return (m >= 390 && m < 1110) ? 'sand' : 'forest';   /* 06:30–18:30 明亮 */
  }
  function themeLocked(){ return getLS('cs2at.themeUser') === '1'; }
  function pickTheme(){
    var q = qs('theme');
    if (THEMES[q]) return q;
    if (themeLocked()){ var s = getLS('cs2at.theme'); if (THEMES[s]) return s; }
    return autoTheme();
  }
  function applyTheme(t, persist){
    if (!THEMES[t]) t = 'sand';
    try{ D.setAttribute('data-theme', t); }catch(e){}
    if (persist){ setLS('cs2at.theme', t); setLS('cs2at.themeUser', '1'); }
    return t;
  }
  applyTheme(pickTheme(), false);     /* 先于 CSS 生效 */

  function tickTheme(){
    if (themeLocked()) return;
    var want = autoTheme();
    if (D.getAttribute('data-theme') !== want) D.setAttribute('data-theme', want);
  }
  setInterval(tickTheme, 60000);
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) tickTheme(); });

  /* ── 2 · --on-acc 自适应：按强调色亮度自动选黑/白字 ─────────────────── */
  (function () {
    function relLum(c){
      var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c||''); if (!m) return 0;
      function f(v){ v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }
      return 0.2126*f(+m[1]) + 0.7152*f(+m[2]) + 0.0722*f(+m[3]);
    }
    var probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden';
    function attach(){ try{ (document.body || document.documentElement).appendChild(probe); }catch(e){} }
    if (document.body) attach(); else addEventListener('DOMContentLoaded', attach);
    function applyOnAcc(){
      var acc = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim();
      if (!acc) return;
      try{ probe.style.color = acc; }catch(e){}
      var L = relLum(getComputedStyle(probe).color || acc);
      if (acc.charAt(0) === '#' && L === 0) return;   /* 拿不到 rgb 时等 load 再试 */
      D.style.setProperty('--on-acc', L > 0.32 ? '#0b0f14' : '#ffffff');
    }
    applyOnAcc();
    try{ new MutationObserver(applyOnAcc).observe(D, { attributes:true, attributeFilter:['class','data-theme','style'] }); }catch(e){}
    try{ addEventListener('load', applyOnAcc); }catch(e){}
  })();

  /* ── 3 · 语言状态 ─────────────────────────────────────────────────────── */
  function isLang(x){ return x === 'zh' || x === 'en'; }
  function defaultLang(){
    var d = D.getAttribute('data-default');
    if (d === 'en' || d === 'zh') return d;            /* 双语文章页：文件标称语言 */
    try{
      return ((navigator.language || 'en').toLowerCase().indexOf('zh') === 0) ? 'zh' : 'en';
    }catch(e){ return 'en'; }
  }
  function pickLang(){
    var q = qs('lang'); if (isLang(q)) return q;
    var s = getLS('cs2at.lang');
    if (s){
      if (s.indexOf('zh') === 0) return 'zh';
      if (s.indexOf('en') === 0) return 'en';
    }
    return defaultLang();
  }
  var LANG = pickLang();
  D.setAttribute('data-vn-lang', LANG);
  D.setAttribute('lang', LANG === 'en' ? 'en' : 'zh-CN');

  var TITLE_ZH = D.getAttribute('data-title-zh');
  var TITLE_EN = D.getAttribute('data-title-en');
  var DICT = null, ZH_DICT = null;

  function translateRoot(root, lang){
    if (!root || !document.createTreeWalker) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())){
      var t = n.nodeValue.trim();
      if (!t) continue;
      if (lang === 'en'){ if (DICT[t]) n.nodeValue = n.nodeValue.replace(t, DICT[t]); }
      else { if (ZH_DICT && ZH_DICT[t]) n.nodeValue = n.nodeValue.replace(t, ZH_DICT[t]); }
    }
    translateAttrs(root, lang);
  }
  /* 属性回译：aria-label / title / placeholder（文本节点遍历碰不到）
     原文存在元素自身的 __origAttr 上，避免 DOMStringMap 的键名限制（含 "-a" 会抛 SyntaxError）。 */
  function translateAttrs(root, lang){
    if (!root || !root.querySelectorAll) return;
    var els = root.querySelectorAll('[aria-label],[title],[placeholder]');
    for (var i = 0; i < els.length; i++){
      var el = els[i];
      var store = el.__origAttr || (el.__origAttr = {});
      var keys = ['aria-label', 'title', 'placeholder'];
      for (var k = 0; k < keys.length; k++){
        var a = keys[k];
        if (!el.hasAttribute(a)) continue;
        var cur = el.getAttribute(a);
        if (lang === 'zh' && store[a] !== undefined){ el.setAttribute(a, store[a]); continue; }
        if (lang !== 'en') continue;
        if (store[a] === undefined) store[a] = cur;
        var orig = store[a] || '', t = orig.trim();
        if (!/[\u4e00-\u9fa5]/.test(t)) continue;
        var out = DICT[t];
        if (out === undefined){
          var m = /^([^\d.]+?)([\s]*[\d.]+)$/.exec(t);
          if (m && DICT[m[1].trim()] !== undefined) out = DICT[m[1].trim()] + m[2];
        }
        if (out !== undefined) el.setAttribute(a, out);
      }
    }
  }
  function articles(){ return document.querySelectorAll('article[data-lang]'); }
  function markSwitches(){
    var els = document.querySelectorAll('.langTop [data-l],.langTop [data-lang],.langsw [data-l],.langsw [data-lang]');
    for (var i = 0; i < els.length; i++){
      var el = els[i];
      var l = el.getAttribute('data-l') || el.getAttribute('data-lang');
      var on = (l === LANG);
      if (el.classList) el.classList.toggle('on', on);
      if (el.tagName === 'BUTTON'){
        if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
      }
    }
  }
  function apply(lang){
    LANG = (lang === 'en') ? 'en' : 'zh';
    D.setAttribute('data-vn-lang', LANG);
    D.setAttribute('lang', LANG === 'en' ? 'en' : 'zh-CN');
    try{ window.LANG = LANG; }catch(e){}
    if (TITLE_ZH && TITLE_EN){
      try{ document.title = (LANG === 'en') ? TITLE_EN : TITLE_ZH; }catch(e){}
    }
    var arts = articles();
    if (arts.length){
      for (var i = 0; i < arts.length; i++) arts[i].hidden = (arts[i].getAttribute('data-lang') !== LANG);
    } else if (DICT){
      translateRoot(document.body, LANG);
    }
    markSwitches();
    try{ document.dispatchEvent(new CustomEvent('vernier:lang', { detail:{ lang: LANG } })); }catch(e){}
    return LANG;
  }
  function set(lang, opts){
    if (!isLang(lang)) return LANG;
    apply(lang);
    setLS('cs2at.lang', lang);
    setLS('vernier.lang', lang);      /* 旧键兼容 */
    if (!opts || opts.url !== false){
      try{ var u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u); }catch(e){}
    }
    return LANG;
  }

  /* ── 4 · 语言开关接线 ─────────────────────────────────────────────────── */
  function switchPoint(el, ev){
    if (ev && isFinite(ev.clientX) && isFinite(ev.clientY) && (ev.clientX || ev.clientY)){
      return { x: ev.clientX, y: ev.clientY };
    }
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }
  function runSwitch(el, ev){
    var l = el.getAttribute('data-l') || el.getAttribute('data-lang');
    if (!isLang(l) || l === LANG) return;
    var pt = switchPoint(el, ev);
    var swap = function(){ set(l); };
    if (window.LangRipple && window.LangRipple.run){
      try{ window.LangRipple.run(pt, swap); return; }catch(e){}
    }
    swap();
  }
  function bindSwitches(){
    var els = document.querySelectorAll('.langTop [data-l],.langTop [data-lang],.langsw [data-l],.langsw [data-lang]');
    for (var i = 0; i < els.length; i++){
      (function (el){
        el.addEventListener('click', function (ev){ ev.preventDefault(); runSwitch(el, ev); });
        el.addEventListener('keydown', function (ev){
          if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
          ev.preventDefault(); runSwitch(el, null);
        });
      })(els[i]);
    }
  }

  /* ── 5 · 抖动层自动插入 ───────────────────────────────────────────────── */
  function injectDither(){
    if (document.querySelector('.vn-dither')) return;
    try{
      var d = document.createElement('div');
      d.className = 'vn-dither';
      d.setAttribute('aria-hidden', 'true');
      document.body.appendChild(d);
    }catch(e){}
  }

  /* ── 6 · 挂载（DOM 就绪后接线 + 首次应用语言） ─────────────────────────── */
  var mounted = false;
  function mount(){
    if (mounted) return;
    mounted = true;
    injectDither();
    bindSwitches();
    apply(LANG);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  /* ── 7 · 对外接口 ─────────────────────────────────────────────────────── */
  window.VernierShell = {
    version: VERSION,
    theme: {
      get: function(){ return D.getAttribute('data-theme'); },
      set: function(t){ return applyTheme(t, true); },
      auto: autoTheme
    },
    lang: {
      get: function(){ return LANG; },
      apply: apply,
      set: function(l){ return set(l); }
    },
    i18n: {
      register: function(en){
        DICT = en || {};
        ZH_DICT = {};
        for (var k in DICT){ if (Object.prototype.hasOwnProperty.call(DICT, k)) ZH_DICT[DICT[k]] = k; }
        if (document.body) apply(LANG);
      }
    }
  };
  window.applyLang = function(l){ return apply(l); };   /* 兼容旧页面 / scripts/qa.cjs */
  window.__VN_SHELL = VERSION;
})();
