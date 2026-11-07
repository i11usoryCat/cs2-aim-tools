#!/usr/bin/env node
/** 设置项往返测试：改每个控件 → 重载 → 看是否恢复。任何不恢复的都是 bug。
 *  用法: node scripts/qa-settings.cjs [--root <dir>]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = process.argv.includes('--root') ? path.resolve(process.argv[process.argv.indexOf('--root') + 1]) : path.resolve(__dirname, '..');
const EDGE = process.env.EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const url = 'file:///' + path.join(ROOT, 'app.html').replace(/\\/g, '/');
const LIST = "(function(){var out=[];document.querySelectorAll('#set input,#set select').forEach(function(e){if(!e.id) return; if(e.type==='button'||e.type==='submit'||e.type==='file') return; var r=e.getBoundingClientRect(); out.push({id:e.id,type:e.type,min:e.getAttribute('min'),max:e.getAttribute('max'),tag:e.tagName,visible:r.width>0&&r.height>0,value:e.value,checked:!!e.checked});});return JSON.stringify(out);})()";
const setCtl = (id, type, value, checked) => {
  if (type === 'checkbox') return "(function(){var e=document.getElementById('" + id + "');e.checked=" + (checked ? 'true' : 'false') + ";e.dispatchEvent(new Event('change',{bubbles:true}));e.dispatchEvent(new Event('input',{bubbles:true}));return e.checked;})()";
  if (type === 'select-one') return "(function(){var e=document.getElementById('" + id + "');var i=-1;for(var k=0;k<e.options.length;k++){if(e.options[k].value==='" + value + "')i=k;}if(i<0)i=(e.selectedIndex+1)%e.options.length;e.selectedIndex=i;e.dispatchEvent(new Event('change',{bubbles:true}));e.dispatchEvent(new Event('input',{bubbles:true}));return e.value;})()";
  return "(function(){var e=document.getElementById('" + id + "');e.value='" + value + "';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value;})()";
};
(async () => {
  const port = 9800;
  const child = spawn(EDGE, ['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--disable-sync','--allow-file-access-from-files','--remote-debugging-port=' + port,'--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'vernierset' + Date.now()),'--window-size=1280,900', url], { stdio: 'ignore' });
  let list = [];
  for (let i = 0; i < 40; i++) { try { list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); if (list.some(t => t.type === 'page' && decodeURI(t.url).indexOf('app.html') >= 0)) break; } catch (e) {} await sleep(250); }
  const page = list.find(t => t.type === 'page' && decodeURI(t.url).indexOf('app.html') >= 0);
  if (!page) { console.log('no target'); process.exit(1); }
  const conn = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(res => { const i = ++id; pend.set(i, res); conn.send(JSON.stringify({ id: i, method: m, params: p })); });
  conn.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  await new Promise(r => conn.onopen = r);
  await send('Runtime.enable');
  await sleep(1500);
  const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
  // 打开设置页
  await ev("(function(){var h=location.hash||'';location.hash='set';if(window.show) window.show('set');return location.hash;})()");
  await sleep(600);
  const ctls = JSON.parse(await ev(LIST) || '[]');
  const rows = [];
  for (const c of ctls) {
    if (!c.visible) { rows.push({ id: c.id, skip: 'hidden' }); continue; }
    let next;
    if (c.type === 'checkbox') next = !c.checked;
    else if (c.type === 'select-one') next = '';
    else if (c.type === 'number' || c.type === 'range') {
      var n = Number(c.value || 0) + 7;
      var mn = (c.min === '' || c.min == null) ? -Infinity : Number(c.min);   // 属性缺失时 getAttribute 返回 null，Number(null)=0 会误 clamp
      var mx = (c.max === '' || c.max == null) ? Infinity : Number(c.max);
      if (isFinite(mn)) n = Math.max(mn, n);
      if (isFinite(mx)) n = Math.min(mx, n);
      next = String(n);
    }
    else next = (c.value || '') + 'X';
    await ev(setCtl(c.id, c.type, next, next));
    await sleep(220);
    await ev('location.reload()').catch(() => {});
    await sleep(1400);
    const after = await ev("(function(){var e=document.getElementById('" + c.id + "');if(!e)return 'MISSING';return e.type==='checkbox'?String(e.checked):e.value;})()");
    const want = c.type === 'checkbox' ? String(next) : (c.type === 'select-one' ? '' : next);
    const ok = c.type === 'select-one' ? after !== c.value : String(after) === want;
    rows.push({ id: c.id, type: c.type, before: c.type === 'checkbox' ? String(c.checked) : c.value, want: want, after: after, ok: ok });
    try { await send('Page.navigate', { url }); } catch (e) {} await sleep(1200);
    await ev("(function(){location.hash='set';if(window.show) window.show('set');return 1;})()");
    await sleep(400);
  }
  fs.writeFileSync(path.join(ROOT, 'qa-settings.json'), JSON.stringify(rows, null, 2));
  const bad = rows.filter(r => r.ok === false);
  console.log('控件 ' + rows.length + ' 个，未通过 ' + bad.length);
  for (const r of rows) console.log('  ' + (r.skip ? '·' : (r.ok ? '✓' : '✗')) + ' ' + r.id + (r.ok === false ? ('  设 ' + r.want + ' → 重载后 ' + r.after) : ''));
  process.exit(0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });