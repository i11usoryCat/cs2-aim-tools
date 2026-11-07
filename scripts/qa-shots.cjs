#!/usr/bin/env node
/** 全站截图：每个页面 1440x900 一张，存 shots/pages/。用于视觉回归与评审。
 *  用法: node scripts/qa-shots.cjs [--root <dir>] [--url <base>]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = process.argv.includes('--root') ? path.resolve(process.argv[process.argv.indexOf('--root') + 1]) : path.resolve(__dirname, '..');
const BASE = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : null;
const EDGE = process.env.EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(ROOT, 'shots', 'pages');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAGES = ['index.html','app.html#play','app.html#set','program.html','tools/aim-trainer.html','tools/aim-trainer.html?mode=staircase','tools/aim-trainer.html?mode=distance','tools/aim-trainer.html?mode=axis','tools/tracking-calibrator.html','tools/openloop-calibrator.html','tools/sensitivity-calibrator-strict.html'];
const urlFor = rel => BASE ? new URL(rel.split('#')[0], BASE).href + (rel.includes('#') ? ('#' + rel.split('#')[1]) : '') : 'file:///' + path.join(ROOT, rel.split('#')[0]).replace(/\\/g, '/') + (rel.includes('#') ? ('#' + rel.split('#')[1]) : '');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let port = 9950;
  for (const rel of PAGES) {
    const url = urlFor(rel);
    port++;
    const child = spawn(EDGE, ['--headless=new','--no-sandbox','--disable-gpu','--hide-scrollbars','--no-first-run','--disable-sync','--allow-file-access-from-files','--remote-debugging-port=' + port,'--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'verniershot' + port),'--window-size=1440,900', url], { stdio: 'ignore' });
    try {
      let list = [];
      for (let i = 0; i < 40; i++) { try { list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); if (list.some(t => t.type === 'page' && !t.url.startsWith('devtools'))) break; } catch (e) {} await sleep(300); }
      const page = list.find(t => t.type === 'page' && !t.url.startsWith('devtools'));
      if (!page) { console.log('x ' + rel); continue; }
      const conn = new WebSocket(page.webSocketDebuggerUrl);
      let id = 0; const pend = new Map();
      const send = (m, p = {}) => new Promise(res => { const i = ++id; pend.set(i, res); conn.send(JSON.stringify({ id: i, method: m, params: p })); });
      conn.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
      await new Promise(r => conn.onopen = r);
      await sleep(1800);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const name = rel.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') + '.png';
      if (shot.result && shot.result.data) fs.writeFileSync(path.join(OUT, name), Buffer.from(shot.result.data, 'base64'));
      console.log('✓ ' + name);
      conn.close();
    } finally { try { child.kill(); } catch (e) {} }
  }
  process.exit(0);
})().catch(e => { console.error('FAILED', e && e.message); process.exit(1); });