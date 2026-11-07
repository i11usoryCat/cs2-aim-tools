#!/usr/bin/env node
/** 设置项语义测试：不只验证值恢复，还验证换算是否正确、是否真的写进模型。
 *  用法: node scripts/qa-settings-semantics.cjs [--root <dir>]
 *  输出: qa-settings-semantics.md / .json
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = process.argv.includes('--root') ? path.resolve(process.argv[process.argv.indexOf('--root') + 1]) : path.resolve(__dirname, '..');
const EDGE = process.env.EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL0 = 'file:///' + path.join(ROOT, 'app.html').replace(/\\/g, '/');
const results = [];
function rec(id, title, ok, detail) { results.push({ id, title, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + id + ' ' + title + ' :: ' + detail); }
async function main() {
  const port = 9830;
  const child = spawn(EDGE, ['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--disable-sync','--allow-file-access-from-files','--remote-debugging-port=' + port,'--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'vset' + Date.now()),'--window-size=1280,900', URL0], { stdio: 'ignore' });
  let list = [];
  for (let i = 0; i < 40; i++) { try { list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); if (list.some(t => t.type === 'page' && decodeURI(t.url).indexOf('app.html') >= 0)) break; } catch (e) {} await sleep(250); }
  const page = list.find(t => t.type === 'page' && decodeURI(t.url).indexOf('app.html') >= 0);
  if (!page) { console.log('no target'); process.exit(1); }
  const conn = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const errs = [];
  const send = (m, p = {}) => new Promise(res => { const i = ++id; pend.set(i, res); conn.send(JSON.stringify({ id: i, method: m, params: p })); });
  conn.onmessage = e => { const m = JSON.parse(e.data); if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception || {}).description || ''); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  await new Promise(r => conn.onopen = r);
  await send('Runtime.enable');
  await sleep(1200);
  const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
  const openSet = async () => { await ev("location.hash='set'; if(window.show) window.show('set'); 1"); await sleep(400); };
  const reload = async () => { await send('Page.reload'); await sleep(1300); };
  const setVal = (id, v) => ev("(function(){var e=document.getElementById('" + id + "');e.value='" + v + "';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value;})()");
  const setSel = (id, v) => ev("(function(){var e=document.getElementById('" + id + "');e.value='" + v + "';e.dispatchEvent(new Event('change',{bubbles:true}));return e.value;})()");
  const get = id => ev("String((document.getElementById('" + id + "')||{}).value)");
  const cfgOf = () => ev("localStorage.getItem('cs2at.cfg')");
  const cmFrom = (sens, yaw, dpi) => 914.4 / (sens * yaw * dpi);
  const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 0.08 : tol) * Math.max(1, Math.abs(b));

  await openSet();
  // 清干净：默认设置
  await ev("localStorage.clear(); 1");
  await reload(); await openSet();

  // S1 CS2：改 cm → sens 应等于公式；再改 sens → cm 回到原值
  await setSel('iGame', 'cs2'); await sleep(200);
  await setVal('iDpi', '800'); await setVal('iYaw', '0.022'); await sleep(150);
  await setVal('iCm', '30'); await sleep(250);
  let sens = parseFloat(await get('iSens')); let want = 914.4 / (30 * 0.022 * 800);
  rec('S1', 'CS2: cm=30 → sens', near(sens, want), 'got ' + sens + ' want ' + want.toFixed(4));
  await setVal('iSens', want.toFixed(4)); await sleep(250);
  let cm = parseFloat(await get('iCm'));
  rec('S1b', 'CS2: 回填 sens → cm 回到 30', near(cm, 30), 'got ' + cm);

  // S2 非 CS2 游戏：cm → 显示灵敏度必须按该游戏 yaw 换算
  await setSel('iGame', 'val'); await sleep(300);
  await setVal('iCm', '30'); await sleep(250);
  sens = parseFloat(await get('iSens')); want = 914.4 / (30 * 0.07 * 800);
  rec('S2', 'VAL: cm=30 → 游戏灵敏度', near(sens, want), 'got ' + sens + ' want ' + want.toFixed(4));

  // S3 非 CS2 游戏：填游戏灵敏度 → cm 应按该游戏 yaw 换算
  await setVal('iSens', want.toFixed(4)); await sleep(300);
  cm = parseFloat(await get('iCm'));
  rec('S3', 'VAL: 回填游戏灵敏度 → cm', near(cm, 30), 'got ' + cm);

  // S4 持久化：非 CS2 游戏下重载后灵敏度应保留
  await reload(); await openSet(); await sleep(300);
  const gameAfter = await get('iGame');
  const sensAfter = parseFloat(await get('iSens'));
  rec('S4', 'VAL: 重载后灵敏度保留', gameAfter === 'val' && near(sensAfter, want), 'game=' + gameAfter + ' sens=' + sensAfter + ' want ' + want.toFixed(4));

  // S5 非 CS2 游戏下改 DPI：cm 必须跟着变（同一灵敏度物理量守恒）
  const sensBefore = parseFloat(await get('iSens'));
  await setVal('iDpi', '1600'); await sleep(300);
  const cm2 = parseFloat(await get('iCm'));
  const sens2 = parseFloat(await get('iSens'));
  rec('S5', 'VAL: 改 DPI 时 cm 不变、灵敏度减半', near(cm2, 30) && near(sens2, sensBefore / 2),
      'cm ' + cm2 + ' (want 30), sens ' + sens2 + ' (want ' + (sensBefore / 2).toFixed(4) + ')');

  // S6 边界：delay / alpha 必须 clamp 后落盘
  await ev("localStorage.clear(); 1"); await reload(); await openSet();
  await setVal('iDelay', '99'); await sleep(150);
  const d = await ev("localStorage.getItem('cs2at.delay')");
  rec('S6', 'delay 超界写入被 clamp', Number(d) <= 5 && Number(d) >= 0, 'stored ' + d);
  await setVal('iDelay', '-3'); await sleep(150);
  const d2 = await ev("localStorage.getItem('cs2at.delay')");
  rec('S6b', 'delay 负值被 clamp', Number(d2) >= 0, 'stored ' + d2);

  // S7 重置数据：应清空 best/runs/log/start
  await ev("localStorage.setItem('cs2at.best','{\"x\":1}');localStorage.setItem('cs2at.runs','[1]');localStorage.setItem('cs2at.log','[]');localStorage.setItem('cs2at.start','1');1");
  const clicked = await ev("(function(){window.confirm=function(){return true;};var b=document.getElementById('clrBtn');if(!b)return 'no button';b.click();return 'clicked';})()");
  if(String(clicked) !== 'clicked') rec('S7-pre', '找到清空按钮', false, String(clicked));
  await sleep(500);
  const leftovers = await ev("JSON.stringify(['cs2at.best','cs2at.runs','cs2at.log','cs2at.start'].filter(function(k){return localStorage.getItem(k)!==null;}))");
  rec('S7', '重置数据清空训练数据键', JSON.parse(leftovers || '[]').length === 0, 'left: ' + leftovers);

  // S8 场景：点击后重载仍保持
  await ev("localStorage.clear(); 1"); await reload(); await openSet();
  const sc = await ev("(function(){var els=document.querySelectorAll('.sw[data-sc]');if(els.length<2)return '';var id=els[1].dataset.sc;els[1].click();return id;})()");
  await sleep(300); await reload(); await openSet();
  const scAfter = await ev("localStorage.getItem('cs2at.scene')");
  rec('S8', '场景选择持久化', String(scAfter) === String(sc), 'clicked ' + sc + ' stored ' + scAfter);

  // S9 主题：点击后重载仍保持
  const th = await ev("(function(){var els=document.querySelectorAll('.sw[data-th]');if(els.length<2)return '';var id=els[1].dataset.th;els[1].click();return id;})()");
  await sleep(300); await reload(); await openSet();
  const thAfter = await ev("localStorage.getItem('cs2at.theme')");
  rec('S9', '主题选择持久化', String(thAfter) === String(th), 'clicked ' + th + ' stored ' + thAfter);

  // S10 语言：切英文后重载仍英文
  await ev("(function(){var els=document.querySelectorAll('#langSw span[data-lang]');for(var i=0;i<els.length;i++){if(els[i].dataset.lang==='en'){els[i].click();return 1;}}return 0;})()");
  await sleep(2600);
  await reload();
  const langNow = await ev("localStorage.getItem('cs2at.lang')");
  const htmlLang = await ev('document.documentElement.lang');
  rec('S10', '语言切换持久化', langNow === 'en' && htmlLang === 'en', 'stored ' + langNow + ' htmlLang ' + htmlLang);

  // S11 边界：DPI = 0 不应产生 NaN / Infinity
  await ev("localStorage.clear(); 1"); await reload(); await openSet();
  await setVal('iDpi', '0'); await sleep(250);
  const hint = await ev("document.getElementById('calcHint').textContent");
  const badNum = /NaN|Infinity/.test(String(hint));
  rec('S11', 'DPI=0 不产生 NaN/Infinity', !badNum, 'hint: ' + String(hint).slice(0, 60));

  // S12 边界：cm 极小/极大
  await setVal('iDpi', '800'); await setVal('iCm', '1'); await sleep(250);
  const s1 = parseFloat(await get('iSens'));
  await setVal('iCm', '200'); await sleep(250);
  const s2 = parseFloat(await get('iSens'));
  rec('S12', 'cm 边界 1 / 200 得到有限灵敏度', isFinite(s1) && isFinite(s2) && s1 > s2, 'cm=1 → ' + s1 + ' ; cm=200 → ' + s2);

  // S13 边界：灵敏度填 0 不应把 cm 变成 Infinity
  await setVal('iSens', '0'); await sleep(250);
  const cmZero = await get('iCm');
  rec('S13', '灵敏度=0 不写坏 cm', !/Infinity|NaN/.test(String(cmZero)), 'cm=' + cmZero);

  fs.writeFileSync(path.join(ROOT, 'qa-settings-semantics.json'), JSON.stringify({ results, errs }, null, 2));
  const fail = results.filter(r => !r.ok);
  const md = ['# 设置语义测试', '', '| # | 检查 | 结果 | 细节 |', '|---|---|---|---|'].concat(results.map(r => '| ' + r.id + ' | ' + r.title + ' | ' + (r.ok ? 'PASS' : 'FAIL') + ' | ' + String(r.detail).replace(/\|/g, '/') + ' |'));
  fs.writeFileSync(path.join(ROOT, 'qa-settings-semantics.md'), md.join('\n'));
  console.log('\n共 ' + results.length + ' 项，失败 ' + fail.length);
  conn.close(); child.kill(); process.exit(fail.length ? 2 : 0);
}
main().catch(e => { console.error('FAILED', e && e.message); process.exit(1); });