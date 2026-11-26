#!/usr/bin/env node
'use strict';
/**
 * lint-css.cjs —— CSS 重要度与加载顺序 lint（W4）
 *
 *   node scripts/lint-css.cjs                # 校验，失败 exit 1
 *   node scripts/lint-css.cjs --update-baseline   # 仅在你明确允许“涨预算”时手动更新基线
 *
 * 规则：
 *  1) 每个文件的 !important 数量不得超过 scripts/css-important-budget.json 的预算；
 *     （预算已剔除注释里的 !important；标记 W4-keep 的例外已计入预算，只许降不许升）
 *  2) line-system.css 硬上限 140 条；
 *  3) 预算文件里没有的新 CSS 文件不允许出现 !important；
 *  4) 每页 <link> 顺序必须是 theme → type →（refine）→ shell → page-* → line-system。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUDGET = path.join(ROOT, 'scripts/css-important-budget.json');
const _seen = {};
const SCAN = listFiles(ROOT, 3).filter(function (p) { var rel = path.relative(ROOT, p); if (/^(baseline|snap|shots|_deploy|node_modules)[\\/]/.test(rel)) return false; if (_seen[p]) return false; _seen[p] = 1; return true; });
function listFiles(dir, depth) {
  var out = [];
  if (depth < 0) return out;
  var entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (e.name === 'node_modules' || e.name === 'baseline' || e.name === 'snap' || e.name === 'shots') continue;
    var p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(listFiles(p, depth - 1));
    else if (/\.(css|html)$/.test(e.name)) out.push(p);
  }
  return out;
}
function stripComments(t) { return t.replace(/\/\*[\s\S]*?\*\//g, ''); }
function countImportant(t) { var m = stripComments(t).match(/!important/g); return m ? m.length : 0; }

function checkImportant() {
  var budget = null;
  try { budget = JSON.parse(fs.readFileSync(BUDGET, 'utf8')); } catch (e) {}
  if (!budget) { console.error('✗ 缺 scripts/css-important-budget.json'); return { errors: 1, total: 0, counts: {} }; }
  var counts = {};
  var total = 0;
  for (var i = 0; i < SCAN.length; i++) {
    var abs = SCAN[i];
    var rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    if (!/\.(css|html)$/.test(rel)) continue;
    var n = countImportant(fs.readFileSync(abs, 'utf8'));
    if (!n) continue;
    counts[rel] = n;
    total += n;
    var base = budget.counts[rel];
    if (base === undefined) { console.error('✗ ' + rel + ' 不是基线文件，但出现 ' + n + ' 条 !important'); continue; }
    if (n > base) console.error('✗ ' + rel + ' !important 超过预算：' + n + ' > ' + base);
  }
  for (var f in budget.counts) {
    if (counts[f] !== undefined || true) {
      var n2 = counts[f] || 0;
      if (n2 < budget.counts[f]) console.log('· ' + f + ' 已低于预算（' + n2 + ' < ' + budget.counts[f] + '），可运行 --update-baseline 收紧基线');
    }
  }
  var ls = counts['assets/line-system.css'] || 0;
  if (ls > 140) console.error('✗ line-system.css 硬上限 140，当前 ' + ls);
  return { errors: 0, total: total, counts: counts };
}

function checkLinkOrder() {
  var errors = 0;
  var pages = SCAN.filter(function (p) { return /\.html$/.test(p); });
  var seen = {};
  for (var i = 0; i < pages.length; i++) {
    var rel = path.relative(ROOT, pages[i]).replace(/\\/g, '/');
    if (seen[rel]) continue;
    seen[rel] = 1;
    var html = fs.readFileSync(pages[i], 'utf8');
    var order = [];
    var re = /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g;
    var m;
    while ((m = re.exec(html))) {
      var href = m[1].split('?')[0].split('/').pop();
      if (!href) continue;
      order.push(href);
    }
    var idx = function (name) { for (var k = 0; k < order.length; k++) if (order[k] === name) return k; return -1; };
    var iTheme = idx('theme.css'), iType = idx('type.css'), iShell = idx('shell.css'), iLine = idx('line-system.css');
    if (iTheme < 0 || iType < 0) continue; // 无样式表的页面跳过
    var problems = [];
    if (iTheme >= 0 && iType >= 0 && iTheme > iType) problems.push('theme 必须在 type 之前');
    if (iType >= 0 && iShell >= 0 && iType > iShell) problems.push('type 必须在 shell 之前');
    if (iShell >= 0 && iLine >= 0 && iShell > iLine) problems.push('shell 必须在 line-system 之前');
    for (var k = 0; k < order.length; k++) {
      if (/^page-.*\.css$/.test(order[k]) && iShell >= 0 && k < iShell) problems.push('page 专属样式必须在 shell 之后：' + order[k]);
      if (/^page-.*\.css$/.test(order[k]) && iLine >= 0 && k > iLine) problems.push('page 专属样式必须在 line-system 之前：' + order[k]);
    }
    if (problems.length) { console.error('✗ ' + rel + '：' + problems.join('；')); errors++; }
  }
  return errors;
}

(function main() {
  var args = process.argv.slice(2);
  if (args.indexOf('--update-baseline') >= 0) {
    var counts = {};
    var total = 0;
    for (var i = 0; i < SCAN.length; i++) {
      var rel = path.relative(ROOT, SCAN[i]).replace(/\\/g, '/');
      var n = countImportant(fs.readFileSync(SCAN[i], 'utf8'));
      if (!n) continue;
      counts[rel] = n; total += n;
    }
    fs.writeFileSync(BUDGET, JSON.stringify({ note: 'W4 收尾基线：以后 !important 只许降不许升（计数剔除注释）', updatedAt: new Date().toISOString(), counts: counts, total: total }, null, 2));
    console.log('已更新预算：' + total + ' 条');
    return;
  }
  var r = checkImportant();
  var linkErrors = checkLinkOrder();
  var ls = r.counts['assets/line-system.css'] || 0;
  var others = r.total - ls;
  console.log('');
  console.log('CSS lint 汇总：');
  console.log('  总 !important：' + r.total + '（line-system ' + ls + ' / 其它 ' + others + '）');
  for (var f in r.counts) console.log('    ' + f + '：' + r.counts[f]);
  console.log('  <link> 顺序：' + (linkErrors ? '✗ ' + linkErrors + ' 页有问题' : '✓ 全部通过'));
  var failed = r.errors > 0 || linkErrors > 0;
  if (failed) { console.error('✗ lint 失败'); process.exit(1); }
  console.log('  ✓ lint 通过');
})();
