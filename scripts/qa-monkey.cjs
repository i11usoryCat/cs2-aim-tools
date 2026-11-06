#!/usr/bin/env node
/** Vernier 交互猴测试 v2 — 每个按钮单独重载后点击，任何 CDP 调用 5s 超时，绝不挂死。
 *  用法: node scripts/qa-monkey.cjs [--root <dir>] [--max 12]
 *  输出: qa-monkey.md / qa-monkey.json
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = process.argv.includes('--root') ? path.resolve(process.argv[process.argv.indexOf('--root') + 1]) : path.resolve(__dirname, '..');
const MAX = process.argv.includes('--max') ? parseInt(process.argv[process.argv.indexOf('--max') + 1], 10) : 15;
const EDGE = process.env.EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAGES = ['index.html','app.html','program.html','tools/aim-trainer.html','tools/tracking-calibrator.html','tools/openloop-calibrator.html','tools/sensitivity-calibrator-strict.html'];
const urlFor = rel => 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/');
const SEL = 'button,[role=button]';
const COUNT = "(function(){var e=[].slice.call(document.querySelectorAll('" + SEL + "'));return e.filter(function(x){var r=x.getBoundingClientRect();return r.width>0&&r.height>0&&!x.disabled;}).length;})()";
const clickI = i => "(function(){var e=[].slice.call(document.querySelectorAll('" + SEL + "'));var v=e.filter(function(x){var r=x.getBoundingClientRect();return r.width>0&&r.height>0&&!x.disabled;});var b=v[" + i + "];if(!b)return null;var l=(b.innerText||b.id||b.getAttribute('aria-label')||b.tagName).replace(/\\s+/g,' ').trim().slice(0,30);b.click();return l;})()";
function withTimeout(p, ms, tag){ return Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout:'+(tag||''))), ms))]); }
async function openPage(rel, port) {
  const want = urlFor(rel);
  const child = spawn(EDGE, ['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--disable-sync','--allow-file-access-from-files','--remote-debugging-port=' + port,'--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'vmonkey' + port),'--window-size=1280,900', want], { stdio: 'ignore' });
  let list = [];
  for (let i = 0; i < 40; i++) { try { list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); if (list.some(t => t.type === 'page' && decodeURI(t.url).indexOf(want) === 0)) break; } catch (e) {} await sleep(250); }
  const page = list.find(t => t.type === 'page' && decodeURI(t.url).indexOf(want) === 0);
  if (!page) { try { child.kill(); } catch (e) {} return null; }
  const conn = new WebSocket(page.webSocketDebuggerUrl);
  const st = { id: 0, pend: new Map(), errs: [], child, conn };
  st.send = (m, p = {}) => { const i = ++st.id; const pr = new Promise(res => { st.pend.set(i, res); conn.send(JSON.stringify({ id: i, method: m, params: p })); }); return withTimeout(pr, 5000, m); };
  conn.onmessage = e => { const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') st.errs.push(String((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text || '').split('\n')[0]);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') st.errs.push('log: ' + m.params.entry.text.slice(0, 100));
    if (m.id && st.pend.has(m.id)) { st.pend.get(m.id)(m); st.pend.delete(m.id); } };
  await withTimeout(new Promise(r => conn.onopen = r), 5000, 'open');
  await st.send('Runtime.enable');
  await st.send('Log.enable');
  await sleep(1400);
  st.ev = async x => { try { const r = await st.send('Runtime.evaluate', { expression: x, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; } catch (e) { return undefined; } };
  return st;
}
async function closePage(st) { try { st.conn.close(); } catch (e) {} try { st.child.kill(); } catch (e) {} }
(async () => {
  const rows = []; let port = 9600;
  for (const rel of PAGES) {
    const st = await openPage(rel, ++port);
    if (!st) { rows.push({ page: rel, error: 'target not found' }); console.log('x ' + rel); continue; }
    let n = 0; try { n = (await st.ev(COUNT)) || 0; } catch (e) {}
    const clicks = [];
    const limit = Math.min(n, MAX);
    for (let i = 0; i < limit; i++) {
      const errsBefore = st.errs.length;
      const label = await st.ev(clickI(i));
      await sleep(300);
      const before = await st.ev('location.href');
      clicks.push({ i, label: String(label || ''), errs: st.errs.slice(errsBefore) });
      // 重载，保证下一次点击从干净状态开始
      try { await st.send('Page.reload', { ignoreCache: false }); } catch (e) {}
      await sleep(700);
    }
    rows.push({ page: rel, buttons: n, clicks: clicks });
    await closePage(st);
    process.stdout.write('.');
  }
  console.log('');
  fs.writeFileSync(path.join(ROOT, 'qa-monkey.json'), JSON.stringify(rows, null, 2));
  const lines = ['# 交互猴测试', '', '每个按钮：重载页面 → 点击 → 收集异常', ''];
  let bad = 0;
  for (const r of rows) {
    if (r.error) { lines.push('## ' + r.page + ' — 加载失败：' + r.error); bad++; continue; }
    const err = (r.clicks || []).filter(c => c.errs && c.errs.length);
    lines.push('## ' + r.page + ' — 按钮 ' + r.buttons + ' 个，点击 ' + (r.clicks || []).length + ' 次，异常 ' + err.length + ' 条');
    for (const c of err) { lines.push('- **' + c.label + '** → ' + c.errs.join(' | ')); bad++; }
  }
  fs.writeFileSync(path.join(ROOT, 'qa-monkey.md'), lines.join('\n'));
  console.log('异常条目: ' + bad);
  for (const l of lines) if (l.startsWith('- ')) console.log(' ' + l);
  process.exit(0);
})().catch(e => { console.error('MONKEY FAILED', e && e.message); process.exit(1); });