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
// ——— 新增：aim-trainer axis 模式、9 个训练模式结果页、en/ 一致性 ———
const EXTRA_PAGES = ['tools/aim-trainer.html?mode=axis'];
const MODES = ['random','block','precision','wide','track','check','staircase','distance','axis'];
const MODE_LABEL = {random:'自适应随机',block:'定角重复',precision:'小球精度',wide:'大角度甩枪',track:'移动跟枪',check:'六维检查',staircase:'阶梯精度',distance:'随机距离',axis:'分轴定位'};
const MODE_EXPECT = {
  random:['读数'], block:['读数'], precision:['读数'], wide:['读数'], track:['读数'],
  check:['反应','第一枪'], staircase:['阶梯'], distance:['距离','分箱'], axis:['T1','T2','渐隐 A']
};
// 结果页驱动：applyModeDefaults / beginSession / spawn / judge / finish 都是页面暴露的测试入口
const DRIVE_EXPR = function(trials){
  return '(async()=>{' +
    'var out={};out.mode=(document.getElementById("mode")||{}).value;' +
    'try{applyModeDefaults();beginSession();' +
      'for(var i=0;i<' + trials + ';i++){spawn();await new Promise(function(r){setTimeout(r,25);});judge();}' +
    '}catch(e){out.driveErr=String(e&&e.stack||e);}' +
    'try{finish();}catch(e){out.finishErr=String(e&&e.stack||e);}' +
    'await new Promise(function(r){setTimeout(r,400);});' +
    'var res=document.getElementById("res"),body=document.getElementById("resBody");' +
    'out.resShown=!!res&&res.classList.contains("show");' +
    'out.len=body?body.innerHTML.length:0;' +
    'out.text=body?String(body.innerText||""):"";' +
    'out.nan=/NaN|undefined|Infinity/.test(out.text);' +
    'out.buttons=[].slice.call(document.querySelectorAll("#res button")).filter(function(b){var r=b.getBoundingClientRect();return r.width>0&&r.height>0;}).map(function(b){return b.id||String(b.textContent||"").trim().slice(0,14);});' +
    'out.axisReport=window.__axisReport||null;' +
    'return JSON.stringify(out);' +
  '})()';
};
function judgeModeResult(m, r){
  const reasons = [];
  if (!r) return ['无返回'];
  if (r.parseError) reasons.push('解析失败: ' + r.parseError);
  if (r.driveErr) reasons.push('驱动异常: ' + String(r.driveErr).split('\n')[0].slice(0, 120));
  if (r.finishErr) reasons.push('finish 异常: ' + String(r.finishErr).split('\n')[0].slice(0, 120));
  if (r.errors && r.errors.length) reasons.push('页面异常: ' + r.errors.slice(0, 2).join(' | ').slice(0, 180));
  if (!r.resShown) reasons.push('结果页未显示');
  if ((r.len || 0) < 80) reasons.push('结果页内容过短 len=' + (r.len || 0));
  if (r.nan) reasons.push('结果页出现 NaN/undefined/Infinity');
  (MODE_EXPECT[m] || []).forEach(function(t){ if (String(r.text || '').indexOf(t) < 0) reasons.push('缺少关键文案「' + t + '」'); });
  if (m === 'axis' && (!r.axisReport || typeof r.axisReport.t1 !== 'number')) reasons.push('window.__axisReport 未生成 T1');
  return reasons;
}
// en/ 静态链接扫描：属性 / meta-refresh / JS 跳转
function scanEnLinks(src){
  const found = [];
  let m;
  const reHref = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  while ((m = reHref.exec(src))) found.push({ raw: m[1], kind: 'attr' });
  const reMeta = /http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*["'][^"']*?url=([^"';]+)/gi;
  while ((m = reMeta.exec(src))) found.push({ raw: m[1], kind: 'meta-refresh' });
  const reJs = /location\.(?:replace|assign)\s*\(\s*["']([^"']+)["']|location\.href\s*=\s*["']([^"']+)["']/gi;
  while ((m = reJs.exec(src))) found.push({ raw: m[1] || m[2], kind: 'js-nav' });
  return found;
}
function checkEnFile(src){
  const dead = [], links = [], seen = {};
  scanEnLinks(src).forEach(function(l){
    const raw = String(l.raw || '').trim();
    if (!raw || /^(https?:|mailto:|tel:|data:|javascript:|blob:|#|\/\/)/i.test(raw)) return;
    const clean = raw.split('#')[0].split('?')[0];
    if (!clean) return;
    links.push(raw);
    let ok = false;
    try { ok = fs.existsSync(path.resolve(path.join(ROOT, 'en'), clean)); } catch (e) {}
    if (!ok) {
      if (!seen[raw]) { seen[raw] = { raw: raw, kinds: [] }; dead.push(seen[raw]); }
      if (seen[raw].kinds.indexOf(l.kind) < 0) seen[raw].kinds.push(l.kind);
    }
  });
  return { links: links, dead: dead };
}
function enModeOptions(src){
  const m = src.match(/id="mode"[\s\S]{0,1600}?<\/select>/);
  if (!m) return [];
  const out = [], re = /<option value="([^"]+)"/g;
  let x;
  while ((x = re.exec(m[0]))) out.push(x[1]);
  return out;
}
const EN_UI_EXPR = '(function(){try{' +
  'if(typeof applyLang==="function")applyLang("en");' +
  'var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),n,arr=[];var SKIP={SCRIPT:1,STYLE:1,NOSCRIPT:1};' +
  'var isCjk=function(t){for(var k=0;k<t.length;k++){var c=t.charCodeAt(k);if(c>=19968&&c<=40869)return true;}return false;};' +
  'while((n=w.nextNode())){var p=n.parentElement;if(p&&SKIP[p.tagName])continue;' +
  'if(p&&p.closest&&p.closest("[hidden]"))continue;' +   // 双语同页：隐藏的那一半不算残留
  'var t=(n.nodeValue||"").trim();if(!t)continue;' +
  'if(!isCjk(t))continue;if(t==="中"||t==="中文")continue;arr.push(t.slice(0,24));}' +
  'return JSON.stringify({n:arr.length,sample:arr.slice(0,8),lang:document.documentElement.lang,title:document.title});' +
  '}catch(e){return JSON.stringify({err:String(e&&e.message)});}})()';

function listPages() {
  const out = [];
  const walk = (dir, prefix) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? prefix + '/' + f.name : f.name;
      if (f.isDirectory()) { if (['node_modules','.git','assets','docs','scripts','windows'].includes(f.name)) continue; walk(path.join(dir, f.name), rel); }
      else if (f.name.endsWith('.html') && !/(backup|_fb|logo-|结果页预览|crystal-preview)/.test(f.name)) {
        // 跳转 stub 会在检查前就 location.replace 走，导致把目标页的链接算到它头上——单独跳过，
        // 由发布流程里的「跳转验收」负责检查它们。
        const src = fs.readFileSync(path.join(dir, f.name), 'utf8');
        if (/<meta http-equiv="refresh"|location\.replace\(/.test(src)) { continue; }
        out.push(rel);
      }
    }
  };
  walk(ROOT, '');
  // program.html 是 iframe 内嵌的老页面，加载较重；放到最前面检查，避免跑到第 20 个时被系统资源拖死
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
async function withPage(rel, port, fn, attempt = 0) {
  const want = urlFor(rel);
  const child = spawn(EDGE, ['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--disable-sync','--allow-file-access-from-files','--remote-debugging-port=' + port,'--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'vernierqa' + port + '-' + process.pid + '-' + Date.now()),'--window-size=1280,900', want], { stdio: 'ignore' });
  try {
    let list = [];
    for (let i = 0; i < 90; i++) { try { list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); if (list.some(t => t.type === 'page' && (t.url === want || t.url.indexOf(want) === 0 || t.url.indexOf(encodeURI(want)) === 0))) break; } catch (e) {} await sleep(250); }
    // 兜底：每个页面都独占一个浏览器实例，只有一个 page target；
    // URL 匹配在个别页面（如 program.html）会因 URL 规范化差异失败，此时直接取唯一 page，避免误报 target not found
    const page = list.find(t => t.type === 'page' && (t.url === want || t.url.indexOf(want) === 0 || t.url.indexOf(encodeURI(want)) === 0))
      || list.find(t => t.type === 'page' && /^file:/.test(t.url || ''));
    if (!page) {
      // 偶发：浏览器实例没起来（端口/资源竞争）→ 退避后换端口重试，最多 2 次
      try { child.kill(); } catch (e) {}
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1200 + attempt * 800));
        return withPage(rel, port + 997, fn, attempt + 1);
      }
      return { error: 'target not found: ' + want };
    }
    const conn = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0; const pend = new Map(); const errs = [];
    const rawSend = (m, p = {}) => new Promise(res => { const i = ++id; pend.set(i, res); conn.send(JSON.stringify({ id: i, method: m, params: p })); });
    // 页面主线程卡死（同步死循环）时 Runtime.evaluate 会永不返回：加超时，让 QA 报「页面挂起」而不是挂住整套 QA
    const send = (m, p = {}) => Promise.race([rawSend(m, p), new Promise((_, rej) => setTimeout(() => rej(new Error('cdp-timeout:' + m)), (m === 'Page.navigate' ? 25000 : 15000)))]);
    conn.onmessage = e => { const m = JSON.parse(e.data);
      if (m.method === 'Runtime.exceptionThrown') errs.push(String((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text || '').split('\n')[0]);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push('console.error: ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 120));
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
    await new Promise(r => conn.onopen = r);
    await send('Runtime.enable');
    await sleep(1200);
    const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
    const out = await fn({ ev, errs, send });
    conn.close();
    return out;
  } finally { try { child.kill(); } catch (e) {} }
}
const LINK_CHECK = "(function(){var bad=[],seen={};document.querySelectorAll('a[href],link[href],script[src],img[src]').forEach(function(el){var v=el.getAttribute('href')||el.getAttribute('src')||'';if(!v||/^(https?:|mailto:|tel:|#|javascript:|data:)/i.test(v))return;var p=v.split('#')[0].split('?')[0];if(!p)return;if(!seen[p]){seen[p]=1;bad.push(p);}});return JSON.stringify(bad);})()";
const ID_DUP = "(function(){var m={},dup=[];document.querySelectorAll('[id]').forEach(function(e){if(m[e.id]){if(dup.indexOf(e.id)<0)dup.push(e.id);}else m[e.id]=1;});return JSON.stringify(dup);})()";
const OVERFLOW = "document.documentElement.scrollWidth - document.documentElement.clientWidth";
const I18N = "(function(){ if(typeof EN!=='object') return 'skip'; try{ if(typeof applyLang==='function') applyLang('en'); }catch(e){} var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),n,miss={},total=0;var SKIP={SCRIPT:1,STYLE:1,NOSCRIPT:1};while((n=w.nextNode())){var p=n.parentElement;if(p&&SKIP[p.tagName])continue;var t=(n.nodeValue||'').trim();if(!t)continue;if(!/[\\u4e00-\\u9fa5]/.test(t))continue;if(t==='中'||t==='中文')continue;total++;if(!EN[t]){var hit=false;if(typeof TX_RULES!=='undefined'){for(var i=0;i<TX_RULES.length;i++){if(TX_RULES[i][0].test(t)){hit=true;break;}}}if(!hit)miss[t]=1;}}return JSON.stringify({cjk:total,missing:Object.keys(miss).slice(0,12)});})()";
(async () => {
  const pages = listPages().concat(EXTRA_PAGES).filter(p => !process.env.QA_ONLY || p.indexOf(process.env.QA_ONLY) >= 0);
  const results = [];
  let port = 9400;
  for (const rel of pages) {
    port++;
    await new Promise(r => setTimeout(r, 300));   // 让上一个浏览器实例完全退出，避免端口/资源堆积
    let r;
    try {
      r = await withPage(rel, port, async ({ ev, errs, send }) => {
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
      let enUi = null;
      if (rel.indexOf('en/') === 0) {
        await sleep(200);
        enUi = await ev(EN_UI_EXPR);
      }
      const i18n = await ev(I18N);
      const finalHref = await ev('location.href');
      return { errs: errs, links: links, dups: dups, overflow: overflow, overflowNarrow: overflowNarrow, i18n: i18n, finalHref: finalHref, enUi: enUi };
    });
    } catch (e) {
      r = { error: '页面挂起/超时: ' + String(e && e.message) };
    }
    if (!r.error) r.deadLinks = checkLinks(rel, r.links || [], r.finalHref);
    results.push(Object.assign({ page: rel }, r));
    process.stdout.write('.');
  }
  console.log('');

  // ——— 新增：每个训练模式的结果页渲染检查（遍历 ?mode=） ———
  const modeResults = [];
  let mport = port + 120;
  for (const m of MODES) {
    const relM = 'tools/aim-trainer.html?mode=' + m + '&delay=0';
    let mr;
    try {
      mr = await withPage(relM, ++mport, async ({ ev, errs }) => {
      for (let i = 0; i < 80; i++) {
        const ready = await ev("document.readyState==='complete' && typeof window.finish==='function' && typeof window.applyModeDefaults==='function'");
        if (ready) break;
        await sleep(100);
      }
      await sleep(500);
      let out = {};
      try { out = JSON.parse(await ev(DRIVE_EXPR(40)) || '{}'); } catch (e) { out = { parseError: String(e && e.message) }; }
      out.errors = errs.slice(0, 5);
      return out;
      });
    } catch (e) {
      mr = { parseError: '页面挂起/超时: ' + String(e && e.message) };
    }
    const entry = Object.assign({ mode: m, page: relM }, mr || { error: 'no result' });
    entry.problems = judgeModeResult(m, entry);
    modeResults.push(entry);
    process.stdout.write('m');
  }
  console.log('');

  // ——— 新增：en/ 与中文页一致性（死链 / 跳转 stub / 缺失文案） ———
  const enDir = path.join(ROOT, 'en');
  const enFiles = fs.existsSync(enDir) ? fs.readdirSync(enDir).filter(f => f.endsWith('.html')).sort() : [];
  const enChecks = enFiles.map(f => {
    const esrc = fs.readFileSync(path.join(enDir, f), 'utf8');
    const eres = checkEnFile(esrc);
    const stub = /http-equiv\s*=\s*["']refresh["']/i.test(esrc) || /location\.replace\(/.test(esrc);
    let target = null, targetExists = null, targetLang = null;
    if (stub) {
      const mm = esrc.match(/content\s*=\s*["']0;\s*url=([^"']+)["']/i);
      if (mm) {
        target = mm[1];
        const clean = target.split('#')[0].split('?')[0].replace(/^\.\.\//, '');
        targetExists = fs.existsSync(path.join(ROOT, clean));
        try { targetLang = /get\(["']lang["']\)/.test(fs.readFileSync(path.join(ROOT, clean), 'utf8')); } catch (e) { targetLang = false; }
      }
    }
    return { file: 'en/' + f, links: eres.links.length, dead: eres.dead, stub: stub, target: target, targetExists: targetExists, targetLang: targetLang };
  });
  let mirrorDiff = null;
  const zhAimPath = path.join(ROOT, 'tools/aim-trainer.html');
  const enSixPath = path.join(enDir, 'six-dim.html');
  if (fs.existsSync(zhAimPath) && fs.existsSync(enSixPath)) {
    const zhSrc = fs.readFileSync(zhAimPath, 'utf8');
    const enSrc = fs.readFileSync(enSixPath, 'utf8');
    const zhModes = enModeOptions(zhSrc), enModes = enModeOptions(enSrc);
    const missingModes = zhModes.filter(v => enModes.indexOf(v) < 0);
    const markers = ['T1','T2','渐隐','分轴定位','阶梯精度','随机距离'];
    const missingText = markers.filter(t => zhSrc.indexOf(t) >= 0 && enSrc.indexOf(t) < 0);
    let cjk = 0;
    for (let i = 0; i < enSrc.length; i++) { const c = enSrc.charCodeAt(i); if (c >= 19968 && c <= 40869) cjk++; }
    mirrorDiff = { zhMtime: fs.statSync(zhAimPath).mtime.toISOString(), enMtime: fs.statSync(enSixPath).mtime.toISOString(), zhModes: zhModes, enModes: enModes, missingModes: missingModes, missingText: missingText, cjk: cjk };
  }
  function parseEnUi(r){
    try { return r && r.enUi ? JSON.parse(r.enUi) : null; } catch (e) { return null; }
  }

  // ——— 新增：运行时语言切换检查（初始加载正确 ≠ 运行时切换正确） ———
  const LANG_SWITCH_CJK_ALLOW = ['中', '中文'];
  const LANG_SWITCH_LATIN_ALLOW = ['Vernier','Chrome','Edge','GitHub','Valorant','Apex','Legends','Overwatch','Rainbow','Siege','MODE','PARAMETERS','RESULT','READOUT'];
  function langScanExpr(want, allow){
    return '(function(){' +
      'var ALLOW=' + JSON.stringify(allow) + ';var allow={};ALLOW.forEach(function(x){allow[x]=1;});' +
      'var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),node,items=[];' +
      'var SKIP={SCRIPT:1,STYLE:1,NOSCRIPT:1,TEXTAREA:1};' +
      'var isCjk=function(t){for(var k=0;k<t.length;k++){var c=t.charCodeAt(k);if(c>=19968&&c<=40869)return true;}return false;};' +
      'var isVisible=function(el){var cur=el;while(cur&&cur.nodeType===1){var cs=getComputedStyle(cur);if(cs.display==="none"||cs.visibility==="hidden")return false;cur=cur.parentElement;}return true;};' +
      'var ctxOf=function(el){if(!el)return "";var s=el.id?("#"+el.id):"";var cl=String(el.className||"").split(" ")[0];if(cl)s+="."+cl;return s||el.tagName;};' +
      'while((node=walker.nextNode())){' +
        'var p=node.parentElement;if(p&&SKIP[p.tagName])continue;' +
        'var t=(node.nodeValue||"").trim();if(!t)continue;' +
        'if(' + JSON.stringify(want) + '==="cjk"){' +
          'if(!isCjk(t))continue;if(allow[t])continue;' +
          'items.push({text:t.slice(0,60),ctx:ctxOf(p),visible:isVisible(p)});' +
        '}else{' +
          'if(isCjk(t))continue;' +
          "var m=t.match(/[A-Za-z][A-Za-z'-]{3,}/g);if(!m)continue;" +
          'var hits=[];for(var i=0;i<m.length;i++){if(!allow[m[i]])hits.push(m[i]);}if(!hits.length)continue;' +
          'items.push({text:t.slice(0,60),ctx:ctxOf(p),visible:isVisible(p),words:hits.slice(0,8)});' +
        '}' +
      '}' +
      'return JSON.stringify({n:items.length,items:items.slice(0,25),htmlLang:document.documentElement.lang,pageLang:(typeof LANG!=="undefined"?LANG:null),isEn:(typeof window.__IS_EN==="boolean"?window.__IS_EN:null),title:document.title});' +
    '})()';
  }
  function langClickExpr(sel){
    return '(function(){var e=document.querySelector(' + JSON.stringify(sel) + ');if(!e)return null;var r=e.getBoundingClientRect();var hit=false;try{var el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);hit=!!el&&(el===e||e.contains(el));}catch(x){}return {x:r.left+r.width/2,y:r.top+r.height/2,hit:hit,w:r.width,h:r.height};})()';
  }
  async function langClick(send, ev, sel){
    const r = await ev(langClickExpr(sel));
    if (!r || !r.hit || !r.w) return false;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y, button: 'none', clickCount: 0 });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', buttons: 0, clickCount: 1 });
    return true;
  }
  function langCollectIssues(r){
    const issues = [];
    if (!r) return ['无返回'];
    if (r.fatal) return [String(r.fatal)];
    if (r.zhBefore && typeof r.zhBefore.n === 'number' && r.zhBefore.n === 0) issues.push('前置失败：初始中文态未渲染出中文文案');
    if (r.en && r.en.n > 0) issues.push('中文→EN 后仍有 ' + r.en.n + ' 处中文残留：' + (r.en.items || []).slice(0, 3).map(function(i){ return '「' + i.text + '」' + (i.visible ? '' : '(隐藏)') + '@' + i.ctx; }).join('、'));
    if (r.zh && r.zh.n > 0) issues.push('EN→中 后仍有 ' + r.zh.n + ' 处英文残留：' + (r.zh.items || []).slice(0, 3).map(function(i){ return '「' + i.text + '」' + (i.visible ? '' : '(隐藏)') + '@' + i.ctx; }).join('、'));
    if (r.en && r.en.htmlLang && r.en.htmlLang !== 'en') issues.push('EN 态 html lang=' + r.en.htmlLang);
    if (r.zh && r.zh.htmlLang && r.zh.htmlLang.indexOf('zh') !== 0) issues.push('中文态 html lang=' + r.zh.htmlLang);
    return issues;
  }
  const langResults = [];
  let lport = port + 200;
  // ① app.html：真实点击语言开关（中文 → EN → 中文）
  try {
    const ar = await withPage('app.html?lang=zh', ++lport, async ({ ev, errs, send }) => {
      const out = { page: 'app.html', method: '点击 #langSw 真实切换', errors: (errs || []).slice(0, 5) };
      for (let i = 0; i < 60; i++) {
        if (await ev("document.readyState==='complete' && !!document.getElementById('langSw')")) break;
        await sleep(100);
      }
      await sleep(1200);
      for (const t of ['data', 'play', 'plan', 'set']) { await langClick(send, ev, 'nav a[data-t="' + t + '"]'); await sleep(350); }
      await langClick(send, ev, 'nav a[data-t="play"]'); await sleep(400);
      out.zhBefore = JSON.parse(await ev(langScanExpr('cjk', LANG_SWITCH_CJK_ALLOW)) || '{}');
      out.statsBarZh = String(await ev("(document.getElementById('statsBar')||{}).innerText"));
      out.clickEn = await langClick(send, ev, '#langSw span[data-lang="en"]');
      await sleep(1100);
      out.en = JSON.parse(await ev(langScanExpr('cjk', LANG_SWITCH_CJK_ALLOW)) || '{}');
      out.statsBarEn = String(await ev("(document.getElementById('statsBar')||{}).innerText"));
      out.langStateEn = JSON.parse(await ev("JSON.stringify({htmlLang:document.documentElement.lang,LANG:(typeof LANG!=='undefined'?LANG:null)})") || '{}');
      out.clickZh = await langClick(send, ev, '#langSw span[data-lang="zh"]');
      await sleep(1100);
      out.zh = JSON.parse(await ev(langScanExpr('latin', LANG_SWITCH_LATIN_ALLOW)) || '{}');
      out.statsBarZh2 = String(await ev("(document.getElementById('statsBar')||{}).innerText"));
      out.langStateZh = JSON.parse(await ev("JSON.stringify({htmlLang:document.documentElement.lang,LANG:(typeof LANG!=='undefined'?LANG:null)})") || '{}');
      out.problems = langCollectIssues(out);
      if (out.statsBarEn && /[一-龥]/.test(out.statsBarEn)) out.problems.push('EN 态状态条仍为中文：' + out.statsBarEn);
      return out;
    });
    langResults.push(ar);
    process.stdout.write('l');
  } catch (e) {
    langResults.push({ page: 'app.html', fatal: String(e && e.message) });
  }
  // ② 三个工具页：页面内没有语言切换控件 → ?lang=en / ?lang=zh 双态加载扫描（等价的静/动态文案覆盖）
  for (const relL of ['tools/tracking-calibrator.html', 'tools/openloop-calibrator.html', 'tools/sensitivity-calibrator-strict.html']) {
    try {
      const tr = await withPage(relL + '?lang=en', ++lport, async ({ ev, errs, send }) => {
        const out = { page: relL, method: '页面内无切换控件 → ?lang= 双态扫描', errors: (errs || []).slice(0, 5) };
        for (let i = 0; i < 60; i++) {
          if (await ev("document.readyState==='complete' && !!document.getElementById('msg')")) break;
          await sleep(100);
        }
        await sleep(1000);
        out.toggleCount = await ev("document.querySelectorAll('[data-lang]').length") || 0;
        out.en = JSON.parse(await ev(langScanExpr('cjk', LANG_SWITCH_CJK_ALLOW)) || '{}');
        try { await send('Page.enable'); } catch (e) {}
        const zhUrl = 'file:///' + path.join(ROOT, relL).replace(/\\/g, '/') + '?lang=zh';
        await send('Page.navigate', { url: zhUrl });
        await sleep(1500);
        for (let i = 0; i < 60; i++) {
          if (await ev("document.readyState==='complete' && !!document.getElementById('msg')")) break;
          await sleep(100);
        }
        await sleep(800);
        out.zh = JSON.parse(await ev(langScanExpr('latin', LANG_SWITCH_LATIN_ALLOW)) || '{}');
        out.problems = langCollectIssues(out);
        return out;
      });
      langResults.push(tr);
      process.stdout.write('l');
    } catch (e) {
      langResults.push({ page: relL, fatal: String(e && e.message) });
    }
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

  // 新模式结果页 & en/ 一致性进问题清单
  for (const r of modeResults) {
    if (r.problems && r.problems.length) bad.push({ page: r.page, kind: 'mode-result', detail: r.problems.join(' | ') });
  }
  for (const e of enChecks) {
    if (e.dead.length) bad.push({ page: e.file, kind: 'en-dead-link', detail: e.dead.map(d => d.raw + ' [' + d.kinds.join('/') + ']').join(', ') });
    if (e.stub && (e.targetExists === false || e.targetLang === false)) bad.push({ page: e.file, kind: 'en-stub-target', detail: 'target=' + e.target + ' exists=' + e.targetExists + ' supportsLang=' + e.targetLang });
    const rr = results.find(x => x.page === e.file);
    const ui = parseEnUi(rr);
    if (ui && ui.n > 0) bad.push({ page: e.file, kind: 'en-untranslated', detail: ui.n + ' 条中文残留: ' + (ui.sample || []).join(' | ') });
    if (ui && ui.title && /[\u4e00-\u9fa5]/.test(ui.title)) bad.push({ page: e.file, kind: 'en-title', detail: 'document.title 仍是中文: ' + ui.title });
  }
  if (mirrorDiff && (mirrorDiff.missingModes.length || mirrorDiff.missingText.length)) {
    bad.push({ page: 'en/six-dim.html', kind: 'en-missing-copy', detail: '缺 mode: ' + mirrorDiff.missingModes.join(', ') + ' ; 缺文案: ' + mirrorDiff.missingText.join(', ') });
  }

  // 运行时语言切换问题进问题清单
  for (const r of langResults) {
    if (r.fatal) bad.push({ page: r.page, kind: 'runtime-i18n', detail: '加载失败: ' + r.fatal });
    else if (r.problems && r.problems.length) bad.push({ page: r.page, kind: 'runtime-i18n', detail: r.problems.join(' | ') });
  }
  const lines = ['# Vernier QA 报告', '', '生成时间：' + new Date().toISOString(), '', '| 页面 | console | 重复 id | 溢出@1280 | 溢出@900 | 死链 | 未翻译串 |', '|---|---|---|---|---|---|---|'];
  for (const r of results) {
    let miss = '-'; if (r.i18n && r.i18n !== 'skip') { const j = JSON.parse(r.i18n); miss = String(j.missing.length); }
    lines.push('| ' + r.page + ' | ' + (r.error ? 'FAIL' : (r.errs || []).length) + ' | ' + ((r.dups || []).length) + ' | ' + (r.overflow || 0) + ' | ' + (r.overflowNarrow || 0) + ' | ' + ((r.deadLinks || []).length) + ' | ' + miss + ' |');
  }

  // 模式结果页汇总
  lines.push('', '## 模式结果页（遍历 tools/aim-trainer.html?mode=）', '');
  lines.push('| 模式 | 结果页显示 | 内容长度 | 关键读数 | 异常 | 结论 |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of modeResults) {
    const ok = !r.problems || !r.problems.length;
    let key = '';
    if (r.axisReport) key = 'T1=' + r.axisReport.t1 + 'ms · T2=' + r.axisReport.t2 + 'ms · A' + r.axisReport.level + ' · n=' + r.axisReport.n;
    else key = String(r.text || '').split('\n').join(' ').split('\r').join(' ').slice(0, 40);
    lines.push('| ' + r.mode + ' | ' + (r.resShown ? '✅' : '❌') + ' | ' + (r.len || 0) + ' | ' + key.split('|').join('/') + ' | ' + ((r.errors || []).length) + ' | ' + (ok ? '✅ 通过' : '❌ ' + r.problems.join('；')) + ' |');
  }
  lines.push('', '## en/ 与中文页一致性', '');
  lines.push('| en 页面 | 相对链接 | 死链 | 运行时中文残留 | 备注 |');
  lines.push('|---|---|---|---|---|');
  for (const e of enChecks) {
    const rr = results.find(x => x.page === e.file);
    const ui = parseEnUi(rr);
    const cjkN = ui && typeof ui.n === 'number' ? ui.n : '-';
    const remark = e.stub ? ('跳转 stub → ' + e.target + (e.targetExists ? '（目标存在）' : '（目标缺失）') + (e.targetLang ? ' · 目标支持 ?lang=en' : ' · 目标不支持 ?lang=en')) : '';
    lines.push('| ' + e.file + ' | ' + e.links + ' | ' + (e.dead.length ? e.dead.map(d => d.raw + '[' + d.kinds.join('/') + ']').join('<br>') : '0') + ' | ' + cjkN + ' | ' + remark + ' |');
  }
  if (mirrorDiff) {
    lines.push('', '### 镜像差异：en/six-dim.html ↔ tools/aim-trainer.html', '');
    lines.push('- 中文页最后修改：' + mirrorDiff.zhMtime + '；英文镜像最后修改：' + mirrorDiff.enMtime);
    lines.push('- en/six-dim.html 缺 mode 选项：' + (mirrorDiff.missingModes.length ? mirrorDiff.missingModes.join(', ') : '无'));
    lines.push('- en/six-dim.html 缺新文案：' + (mirrorDiff.missingText.length ? mirrorDiff.missingText.join(', ') : '无'));
    lines.push('- en/six-dim.html 源码中文字符数：' + mirrorDiff.cjk + '（运行时按 navigator.language 判定语言）');
  }

  // 运行时语言切换汇总
  lines.push('', '## 运行时语言切换（初始加载正确 ≠ 运行时切换正确）', '');
  lines.push('| 页面 | 切换方式 | 中文→EN 后 CJK 残留 | EN→中 后拉丁长词残留 | 语言状态 | 结论 |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of langResults) {
    if (r.fatal) { lines.push('| ' + r.page + ' | - | - | - | - | ❌ ' + r.fatal + ' |'); continue; }
    const en = r.en || {}; const zh = r.zh || {};
    const enTxt = en.n ? ('❌ ' + en.n + ' 条：' + (en.items || []).slice(0, 3).map(function(i){ return '「' + i.text + '」' + (i.visible ? '' : '(隐藏)'); }).join('、')) : '✅ 0';
    const zhTxt = zh.n ? ('❌ ' + zh.n + ' 条：' + (zh.items || []).slice(0, 3).map(function(i){ return '「' + i.text + '」' + (i.visible ? '' : '(隐藏)'); }).join('、')) : '✅ 0';
    let langState = 'EN: html=' + (en.htmlLang || '-');
    if (r.langStateEn) langState += ' / LANG=' + JSON.stringify(r.langStateEn.LANG);
    langState += '；中: html=' + (zh.htmlLang || '-');
    if (r.langStateZh) langState += ' / LANG=' + JSON.stringify(r.langStateZh.LANG);
    lines.push('| ' + r.page + ' | ' + r.method + ' | ' + enTxt + ' | ' + zhTxt + ' | ' + langState + ' | ' + ((r.problems && r.problems.length) ? '❌' : '✅') + ' |');
  }
  for (const r of langResults) {
    if (r.page === 'app.html' && !r.fatal) {
      lines.push('', '> app.html 回归点（lead 报的状态条）：EN 态 #statsBar = 「' + String(r.statsBarEn || '').split('\n').join(' / ') + '」；中文态 = 「' + String(r.statsBarZh2 || '').split('\n').join(' / ') + '」。');
    }
  }
  lines.push('', '## 问题清单', '');
  if (!bad.length) lines.push('无。');
  for (const b of bad) lines.push('- **' + b.kind + '** · `' + b.page + '` — ' + b.detail);
  fs.writeFileSync(path.join(ROOT, 'qa-report.md'), lines.join('\n'));
  console.log('问题数: ' + bad.length);
  for (const b of bad) console.log(' - [' + b.kind + '] ' + b.page + ' :: ' + b.detail);
  process.exit(0);
})().catch(e => { console.error('QA FAILED', e); process.exit(1); });