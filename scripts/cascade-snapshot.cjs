#!/usr/bin/env node
'use strict';
/**
 * cascade-snapshot.cjs —— W4 层叠快照工具（规则顺序 + 计算样式）
 *
 *   node scripts/cascade-snapshot.cjs --out=snap/w4-before.json
 *   node scripts/cascade-snapshot.cjs --out=snap/w4-after.json
 *   node scripts/cascade-snapshot.cjs --diff snap/w4-before.json snap/w4-after.json
 *
 * 快照内容：
 *   1) 每页每张 stylesheet 的加载顺序（document.styleSheets 顺序）+ 每条规则的
 *      selectorText / cssText / 序号；
 *   2) 12 页 × 2 主题 × 20 个探针元素的全部 computed property。
 *
 * diff 报告：
 *   - 跨 sheet 顺序变化（必须为 0）；
 *   - 规则新增 / 删除 / 改写（按 sheet 分组列出）；
 *   - 计算样式差异（按页/主题/探针/property 列出前若干条 + 总数）。
 *
 * 依赖：scripts/lib/browser-test.cjs（无第三方依赖），站点服务 127.0.0.1:8808。
 */
const path = require('path');
const fs = require('fs');
const { launchBrowser } = require('./lib/browser-test.cjs');

const BASE = process.env.BASE || 'http://127.0.0.1:8808/';
const OUT_DEFAULT = 'snap/cascade.json';

const PAGES = [
  { id: 'index', url: 'index.html', kind: 'index' },
  { id: 'en-index', url: 'en/index.html', kind: 'index' },
  { id: 'methodology', url: 'methodology.html', kind: 'methodology' },
  { id: 'en-methodology', url: 'en/methodology.html', kind: 'methodology' },
  { id: 'app-data', url: 'app.html#data', kind: 'app' },
  { id: 'app-play', url: 'app.html#play', kind: 'app' },
  { id: 'app-plan', url: 'app.html#plan', kind: 'app' },
  { id: 'app-set', url: 'app.html#set', kind: 'app' },
  { id: 'tools-aim', url: 'tools/aim-trainer.html', kind: 'aim' },
  { id: 'tools-tracking', url: 'tools/tracking-calibrator.html', kind: 'cal' },
  { id: 'tools-openloop', url: 'tools/openloop-calibrator.html', kind: 'cal' },
  { id: 'tools-sensitivity', url: 'tools/sensitivity-calibrator-strict.html', kind: 'cal' },
];
const THEMES = ['sand', 'night'];

const PROBES = {
  index: ['nav', 'nav span', 'main', '#stage', '.hero', '.hero h1', '.hero .brandline', '.hero .sub',
    '.hero .start', '.hero .tip', '.foot', '.foot a', '#eggFormula', '#buildTag', '#langTop',
    '#langTop span', '.logo-mark', '.foot-r', '#mobileTip', '#mtClose'],
  methodology: ['.topbar', '.topbar .back', '.langTop', 'h1', 'h2', 'p', 'blockquote', 'pre',
    'pre code', '.meta', '.eyebrow', '.toc', '.toc a', 'table', 'th', 'td', '.note',
    '.vn-foot', 'main', 'a'],
  app: ['header', 'header .brand-name', 'nav', 'nav a.on', '.lang', '.lang span.on', '.gear',
    'main .card', 'a.tile', 'h2', 'table', '.k', '.v', '.statstrip', '.cal .cell',
    '.cal .cell.today', 'button.main', 'input', 'select', '.vn-foot'],
  aim: ['#back', '#langSwitch', '#msg', '.overlay', '.ov-title', '#go', '#fsBtn', '#more',
    '.fld input', 'table', 'th', 'td', '#hud', '#res', '#again', '.btn', '#titleTop',
    '.vn-dither', 'canvas', 'main'],
  cal: ['#topbar', '#back', '#langSw', '#langSw button', '#langSw .sep', '#msg', '.overlay',
    '.ov-title', '.ov-lede', '#go', '#fsBtn', '#more', '.fld input', '#ui', 'canvas',
    '#res', '#resBody', 'table.rt', '.btn', '.vn-dither'],
};

function initScript(theme, isEN) {
  return '(function(){try{for(var i=localStorage.length-1;i>=0;i--){var k=localStorage.key(i);if(k&&k.indexOf("cs2at.")===0)localStorage.removeItem(k);}' +
    'localStorage.setItem("cs2at.theme",' + JSON.stringify(theme) + ');localStorage.setItem("cs2at.themeUser","1");' +
    'localStorage.setItem("cs2at.lang",' + JSON.stringify(isEN ? 'en' : 'zh') + ');localStorage.setItem("cs2at.mtClosed","1");}catch(e){}' +
    'var F=1795000000000;var R=Date;function D(){return arguments.length?new (Function.prototype.bind.apply(R,[null].concat([].slice.call(arguments))))():new R(F);}' +
    'D.prototype=R.prototype;D.now=function(){return F;};window.Date=D;' +
    'var s=0x9e3779b9;Math.random=function(){s|=0;s=s+0x6d2b79f5|0;var t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};' +
    'try{Object.defineProperty(performance,"now",{value:function(){return 1000;},configurable:true});}catch(e){}' +
    'var raw=window.requestAnimationFrame,n=0;window.requestAnimationFrame=function(cb){return raw.call(window,function(){n++;if(n<=60)cb(1000);});};' +
    '})();';
}

function collectExpression(probes) {
  return '(function(){' +
    'var out={sheets:[],computed:{}};' +
    'var list=document.styleSheets;' +
    'for(var i=0;i<list.length;i++){' +
    '  var ss=list[i], rec={order:i,href:null,inline:false,rules:[]};' +
    '  try{ rec.href=ss.href||null; }catch(e){}' +
    '  if(!rec.href) rec.inline=true;' +
    '  var rules=null; try{ rules=ss.cssRules; }catch(e){ rules=null; }' +
    '  if(rules){ for(var j=0;j<rules.length;j++){ var r=rules[j];' +
    '    rec.rules.push({i:j,sel:(r.selectorText===undefined?("@"+r.type):r.selectorText),text:(r.cssText||"").slice(0,4000)}); } }' +
    '  else rec.blocked=true;' +
    '  out.sheets.push(rec);' +
    '}' +
    'var props=null;' +
    'var probes=' + JSON.stringify(probes) + ';' +
    'for(var q=0;q<probes.length;q++){' +
    '  var sel=probes[q]; var el=null; try{ el=document.querySelector(sel); }catch(e){ el=null; }' +
    '  if(!el){ out.computed[sel]=null; continue; }' +
    '  var cs=getComputedStyle(el);' +
    '  if(!props){ props=[]; for(var k=0;k<cs.length;k++) props.push(cs[k]); }' +
    '  var o={}; for(var p=0;p<props.length;p++) o[props[p]]=cs.getPropertyValue(props[p]);' +
    '  var rect=el.getBoundingClientRect();' +
    '  o["@rect"]=[Math.round(rect.left),Math.round(rect.top),Math.round(rect.width),Math.round(rect.height)];' +
    '  out.computed[sel]=o;' +
    '}' +
    'return out;' +
    '})()';
}

async function snapshot() {
  const browser = await launchBrowser({ base: BASE, width: 1440, height: 900 });
  const out = { meta: { base: BASE, at: new Date().toISOString(), pages: PAGES.map(function (p) { return p.id; }), themes: THEMES }, pages: {} };
  try {
    for (const page of PAGES) {
      const probes = PROBES[page.kind];
      out.pages[page.id] = { url: page.url, kind: page.kind, themes: {} };
      for (const theme of THEMES) {
        const isEN = /^en\//.test(page.url);
        await browser.addInitScript(initScript(theme, isEN));
        const sep = page.url.indexOf('?') >= 0 ? '&' : '?';
        let url = page.url.indexOf('#') >= 0 ? page.url : page.url + sep + '__snap=' + theme;
        if (page.url.indexOf('#') >= 0) {
          const parts = page.url.split('#');
          url = parts[0] + sep + '__snap=' + theme + '#' + parts[1];
        }
        await browser.navigate(url, { waitAfter: 900 });
        await browser.waitFor('document.readyState === "complete" && !!document.querySelector("main") && document.querySelectorAll("body *").length > 20', 8000, 100);
        await new Promise(function (r) { setTimeout(r, 350); });
        let data = await browser.evJSON(collectExpression(probes));
        const allNull = function (d) { var ks = Object.keys(d.computed || {}); for (var i = 0; i < ks.length; i++) if (d.computed[ks[i]]) return false; return true; };
        if (allNull(data)) { await new Promise(function (r) { setTimeout(r, 900); }); data = await browser.evJSON(collectExpression(probes)); }
        if (allNull(data)) throw new Error('页面探针全为空：' + page.id + '/' + theme);
        out.pages[page.id].themes[theme] = { sheets: data.sheets, computed: data.computed };
      }
    }
  } finally { browser.close(); }
  return out;
}

function normSheetId(sheet) {
  if (!sheet.href) return 'inline';
  return sheet.href.replace(/^https?:\/\/[^/]+\//, '');
}

function diff(a, b) {
  const report = { sheetOrderChanges: [], ruleChanges: [], computedDiffCount: 0, computedSamples: [], pagesCompared: 0 };
  for (const pid of Object.keys(a.pages)) {
    const A = a.pages[pid], B = b.pages[pid];
    if (!B) { report.ruleChanges.push({ page: pid, type: 'page-missing' }); continue; }
    report.pagesCompared++;
    for (const theme of Object.keys(A.themes)) {
      const TA = A.themes[theme], TB = B.themes[theme];
      const oa = TA.sheets.map(function (s) { return normSheetId(s) + '|' + s.order; }).join(' > ');
      const ob = TB.sheets.map(function (s) { return normSheetId(s) + '|' + s.order; }).join(' > ');
      if (oa !== ob) report.sheetOrderChanges.push({ page: pid, theme: theme, before: oa, after: ob });
      const bySheet = {};
      for (const s of TA.sheets) { const key = normSheetId(s) + '#' + s.order; if (!bySheet[key]) bySheet[key] = { before: s.rules, after: null }; }
      for (const s of TB.sheets) { const key = normSheetId(s) + '#' + s.order; if (!bySheet[key]) bySheet[key] = { before: null, after: [] }; bySheet[key].after = s.rules; }
      for (const key of Object.keys(bySheet)) {
        const bt = bySheet[key].before || [], af = bySheet[key].after || [];
        const bsig = bt.map(function (r) { return r.sel + '::' + r.text; });
        const asig = af.map(function (r) { return r.sel + '::' + r.text; });
        const setB = new Set(bsig), setA = new Set(asig);
        for (const sig of bsig) if (!setA.has(sig)) report.ruleChanges.push({ page: pid, theme: theme, sheet: key.split('#')[0], type: 'removed', rule: sig.slice(0, 300) });
        for (const sig of asig) if (!setB.has(sig)) report.ruleChanges.push({ page: pid, theme: theme, sheet: key.split('#')[0], type: 'added', rule: sig.slice(0, 300) });
      }
      for (const sel of Object.keys(TA.computed)) {
        const ca = TA.computed[sel], cb = Object.prototype.hasOwnProperty.call(TB.computed || {}, sel) ? TB.computed[sel] : null;
        if (!ca || !cb) { if (!!ca !== !!cb) { report.computedDiffCount++; report.computedSamples.push({ page: pid, theme: theme, sel: sel, prop: '(presence)', before: !!ca, after: !!cb }); } continue; }
        for (const prop of new Set(Object.keys(ca).concat(Object.keys(cb)))) {
          let va = ca[prop], vb = cb[prop];
          if (typeof va === 'object' && va !== null) va = JSON.stringify(va);
          if (typeof vb === 'object' && vb !== null) vb = JSON.stringify(vb);
          if (va !== vb) { report.computedDiffCount++; if (report.computedSamples.length < 200) report.computedSamples.push({ page: pid, theme: theme, sel: sel, prop: prop, before: va, after: vb }); }
        }
      }
    }
  }
  return report;
}

(async () => {
  const args = process.argv.slice(2);
  const outArg = args.find(function (a) { return a.indexOf('--out=') === 0; });
  const diffIdx = args.indexOf('--diff');
  if (diffIdx >= 0) {
    const aPath = args[diffIdx + 1], bPath = args[diffIdx + 2];
    if (!aPath || !bPath) { console.error('用法：--diff a.json b.json'); process.exit(2); }
    const a = JSON.parse(fs.readFileSync(aPath, 'utf8'));
    const b = JSON.parse(fs.readFileSync(bPath, 'utf8'));
    const rep = diff(a, b);
    const repPath = args.find(function (a2) { return a2.indexOf('--report=') === 0; });
    if (repPath) fs.writeFileSync(repPath.split('=')[1], JSON.stringify(rep, null, 2));
    console.log('层叠快照对比');
    console.log('  页面数：' + rep.pagesCompared);
    console.log('  跨 sheet 顺序变化：' + rep.sheetOrderChanges.length + (rep.sheetOrderChanges.length ? '  ✗' : '  ✓ 0'));
    for (const ch of rep.sheetOrderChanges.slice(0, 5)) console.log('    ' + ch.page + '/' + ch.theme + ': ' + ch.before.slice(0, 160) + ' -> ' + ch.after.slice(0, 160));
    const removed = rep.ruleChanges.filter(function (r) { return r.type === 'removed'; });
    const added = rep.ruleChanges.filter(function (r) { return r.type === 'added'; });
    console.log('  规则：- ' + removed.length + ' / + ' + added.length);
    for (const r of removed.slice(0, 12)) console.log('    - [' + r.sheet + '] ' + r.rule.slice(0, 140));
    for (const r of added.slice(0, 12)) console.log('    + [' + r.sheet + '] ' + r.rule.slice(0, 140));
    console.log('  计算样式差异：' + rep.computedDiffCount + (rep.computedDiffCount === 0 ? '  ✓ 0' : '  ✗'));
    for (const s of rep.computedSamples.slice(0, 15)) console.log('    ' + s.page + '/' + s.theme + ' ' + s.sel + ' ' + s.prop + ': ' + JSON.stringify(s.before) + ' -> ' + JSON.stringify(s.after));
    const ok = rep.sheetOrderChanges.length === 0 && removed.length === 0 && added.length === 0 && rep.computedDiffCount === 0;
    console.log('  结论：' + (ok ? 'PASS（0 差异）' : 'DIFF'));
    process.exit(ok ? 0 : 1);
  }
  const outPath = outArg ? outArg.split('=')[1] : OUT_DEFAULT;
  const t0 = Date.now();
  const snap = await snapshot();
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(snap));
  const size = fs.statSync(outPath).size;
  console.log('层叠快照已写入：' + outPath + '（' + (size / 1024 / 1024).toFixed(2) + ' MB，' + ((Date.now() - t0) / 1000).toFixed(1) + 's）');
  console.log('  页面：' + snap.meta.pages.length + '，主题：' + snap.meta.themes.join('/'));
  let sheets = 0, rules = 0, probes = 0;
  for (const p of Object.values(snap.pages)) for (const th of Object.values(p.themes)) {
    sheets += th.sheets.length;
    for (const s of th.sheets) rules += s.rules.length;
    probes += Object.keys(th.computed).length;
  }
  console.log('  sheet 条目：' + sheets + '，规则：' + rules + '，探针：' + probes);
})().catch(function (e) { console.error('失败：', e && e.stack || e); process.exit(1); });
