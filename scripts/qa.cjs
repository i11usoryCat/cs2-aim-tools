#!/usr/bin/env node
/** Vernier QA harness — 全站检查：console / 死链 / 重复 id / 水平溢出 / 语言切换覆盖
 *  用法: node scripts/qa.cjs [--root <dir>]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = process.argv.includes('--root') ? path.resolve(process.argv[process.argv.indexOf('--root') + 1]) : path.resolve(__dirname, '..');
const EDGE = process.env.EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const urlFor = rel => 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/');
function listPages() {
  const out = [];
  const walk = (dir, prefix) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? prefix + '/' + f.name : f.name;
      if (f.isDirectory()) { if (['node_modules','.git','assets','docs','scripts','windows'].includes(f.name)) continue; walk(path.join(dir, f.name), rel); }
      else if (f.name.endsWith('.html') && !/(backup|_fb|logo-|结果页预览)/.test(f.name)) {
        // 跳转 stub 会在检查前就 location.replace 走，导致把目标页的链接算到它头上——单独跳过，
        // 由发布流程里的「跳转验收」负责检查它们。
        const src = fs.readFileSync(path.join(dir, f.name), 'utf8');
        if (/<meta http-equiv="refresh"|location\.replace\(/.test(src)) { continue; }
        out.push(rel);
      }
    }
  };
  walk(ROOT, '');
  return out.sort();
}
function checkLinks(pageRel, links, finalHref) {
  // 用"实际停留的页面"做基准：跳转 stub 会把浏览器带走到别的目录
  let base = path.dirname(path.join(ROOT, pageRel));
  if (finalHref && finalHref.indexOf('file://') === 0) {
    try {
      const fp = decodeURIComponent(new URL(finalHref).pathname).replace(/^\//, '');
      const abs = path.resolve(fp);
      if (abs.toLowerCase().indexOf(path.resolve(ROOT).toLowerCase()) === 0) base = path.dirname(abs);
    } catch (e) {}
  }
  const bad = [];
  for (const link of links) {
    if (/['"`+]|\$\{/.test(link)) continue;   // 内联 JS 里的模板串，不是真链接
    let target = path.resolve(base, link);
    let ok = fs.existsSync(target) || fs.existsSync(target + '.html') || fs.existsSync(path.join(target, 'index.html'));
    if (!ok) bad.push(link);
  }
  return bad;
}
async function withPage(rel, port, fn) {
  const want = urlFor(rel);
  const child = spawn(EDGE, ['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--disable-sync','--allow-file-access-from-files','--remote-debugging-port=' + port,'--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'vernierqa' + port),'--window-size=1280,900', want], { stdio: 'ignore' });
  try {
    let list = [];
    for (let i = 0; i < 40; i++) { try { list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); if (list.some(t => t.type === 'page' && (t.url === want || t.url.indexOf(want) === 0 || t.url.indexOf(encodeURI(want)) === 0))) break; } catch (e) {} await sleep(250); }
    const page = list.find(t => t.type === 'page' && (t.url === want || t.url.indexOf(want) === 0 || t.url.indexOf(encodeURI(want)) === 0));
    if (!page) return { error: 'target not found: ' + want };
    const conn = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0; const pend = new Map(); const errs = [];
    const send = (m, p = {}) => new Promise(res => { const i = ++id; pend.set(i, res); conn.send(JSON.stringify({ id: i, method: m, params: p })); });
    conn.onmessage = e => { const m = JSON.parse(e.data);
      if (m.method === 'Runtime.exceptionThrown') errs.push(String((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text || '').split('\n')[0]);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push('console.error: ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 120));
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
    await new Promise(r => conn.onopen = r);
    await send('Runtime.enable');
    await sleep(1200);
    const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
    const out = await fn({ ev, errs });
    conn.close();
    return out;
  } finally { try { child.kill(); } catch (e) {} }
}
const LINK_CHECK = "(function(){var bad=[],seen={};document.querySelectorAll('a[href],link[href],script[src],img[src]').forEach(function(el){var v=el.getAttribute('href')||el.getAttribute('src')||'';if(!v||/^(https?:|mailto:|tel:|#|javascript:|data:)/i.test(v))return;var p=v.split('#')[0].split('?')[0];if(!p)return;if(!seen[p]){seen[p]=1;bad.push(p);}});return JSON.stringify(bad);})()";
const ID_DUP = "(function(){var m={},dup=[];document.querySelectorAll('[id]').forEach(function(e){if(m[e.id]){if(dup.indexOf(e.id)<0)dup.push(e.id);}else m[e.id]=1;});return JSON.stringify(dup);})()";
const OVERFLOW = "document.documentElement.scrollWidth - document.documentElement.clientWidth";
const I18N = "(function(){ if(typeof EN!=='object') return 'skip'; try{ if(typeof applyLang==='function') applyLang('en'); }catch(e){} var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),n,miss={},total=0;var SKIP={SCRIPT:1,STYLE:1,NOSCRIPT:1};while((n=w.nextNode())){var p=n.parentElement;if(p&&SKIP[p.tagName])continue;var t=(n.nodeValue||'').trim();if(!t)continue;if(!/[\\u4e00-\\u9fa5]/.test(t))continue;if(t==='中'||t==='中文')continue;total++;if(!EN[t]){var hit=false;if(typeof TX_RULES!=='undefined'){for(var i=0;i<TX_RULES.length;i++){if(TX_RULES[i][0].test(t)){hit=true;break;}}}if(!hit)miss[t]=1;}}return JSON.stringify({cjk:total,missing:Object.keys(miss).slice(0,12)});})()";
(async () => {
  const pages = listPages();
  const results = [];
  let port = 9400;
  for (const rel of pages) {
    port++;
    const r = await withPage(rel, port, async ({ ev, errs }) => {
      const links = JSON.parse(await ev(LINK_CHECK) || '[]');
      const dups = JSON.parse(await ev(ID_DUP) || '[]');
      const overflow = await ev(OVERFLOW);
      // 窄屏复查：900px 下是否被撑破（手机 / 分屏）
      let overflowNarrow = 0;
      try {
        await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 800, deviceScaleFactor: 1, mobile: false });
        await sleep(350);
        overflowNarrow = await ev(OVERFLOW) || 0;
        await send('Emulation.clearDeviceMetricsOverride');
      } catch (e) {}
      const i18n = await ev(I18N);
      const finalHref = await ev('location.href');
      return { errs: errs, links: links, dups: dups, overflow: overflow, overflowNarrow: overflowNarrow, i18n: i18n, finalHref: finalHref };
    });
    if (!r.error) r.deadLinks = checkLinks(rel, r.links || [], r.finalHref);
    results.push(Object.assign({ page: rel }, r));
    process.stdout.write('.');
  }
  console.log('');
  fs.writeFileSync(path.join(ROOT, 'qa-report.json'), JSON.stringify(results, null, 2));
  const bad = [];
  for (const r of results) {
    if (r.error) { bad.push({ page: r.page, kind: 'load', detail: r.error }); continue; }
    if (r.errs && r.errs.length) bad.push({ page: r.page, kind: 'console', detail: r.errs.slice(0, 3).join(' | ') });
    if (r.dups && r.dups.length) bad.push({ page: r.page, kind: 'duplicate-id', detail: r.dups.join(', ') });
    if (r.overflow > 2) bad.push({ page: r.page, kind: 'overflow@1280', detail: 'scrollWidth - clientWidth = ' + r.overflow });
    if (r.overflowNarrow > 4) bad.push({ page: r.page, kind: 'overflow@900', detail: 'scrollWidth - clientWidth = ' + r.overflowNarrow });
    if (r.deadLinks && r.deadLinks.length) bad.push({ page: r.page, kind: 'dead-link', detail: r.deadLinks.join(', ') });
    if (r.i18n && r.i18n !== 'skip') { const j = JSON.parse(r.i18n); if (j.missing.length) bad.push({ page: r.page, kind: 'i18n', detail: j.missing.join(' | ') }); }
  }
  const lines = ['# Vernier QA 报告', '', '生成时间：' + new Date().toISOString(), '', '| 页面 | console | 重复 id | 溢出@1280 | 溢出@900 | 死链 | 未翻译串 |', '|---|---|---|---|---|---|---|'];
  for (const r of results) {
    let miss = '-'; if (r.i18n && r.i18n !== 'skip') { const j = JSON.parse(r.i18n); miss = String(j.missing.length); }
    lines.push('| ' + r.page + ' | ' + (r.error ? 'FAIL' : (r.errs || []).length) + ' | ' + ((r.dups || []).length) + ' | ' + (r.overflow || 0) + ' | ' + (r.overflowNarrow || 0) + ' | ' + ((r.deadLinks || []).length) + ' | ' + miss + ' |');
  }
  lines.push('', '## 问题清单', '');
  if (!bad.length) lines.push('无。');
  for (const b of bad) lines.push('- **' + b.kind + '** · `' + b.page + '` — ' + b.detail);
  fs.writeFileSync(path.join(ROOT, 'qa-report.md'), lines.join('\n'));
  console.log('问题数: ' + bad.length);
  for (const b of bad) console.log(' - [' + b.kind + '] ' + b.page + ' :: ' + b.detail);
  process.exit(0);
})().catch(e => { console.error('QA FAILED', e); process.exit(1); });