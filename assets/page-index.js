/* ============================================================================
   page-index.js — 落地页专属（index.html / en/index.html 共用）
   ----------------------------------------------------------------------------
   只放「这一页才有」的东西：
     · 中英词典（外壳在 assets/shell.js，翻译与切换由外壳统一执行）
     · 两个彩蛋（页脚公式连点 3 次 / 版本号连点 7 次）
     · 手机提示条 + 剪贴板兜底
   主题 / 语言状态 / 语言切换接线 / 抖动层全部在 assets/shell.js。
   ========================================================================== */
var EN = {
    '甩枪训练中心':'AIM TRAINING HUB',
    '瞄准，度量。':'Aim, measured.','aim, measured':'aim, measured',
    '分毫 · 灵敏度标定 · 甩枪训练 · 四周计划':'Vernier · calibration · drills · four-week plan',
    '灵敏度标定 · 甩枪训练 · 四周计划':'Calibration · drills · four-week plan','浏览器里的灵敏度标定与甩枪训练。':'Sensitivity calibration and flick training in the browser.','浏览器端 · 无需安装 · 不读取游戏数据':'Browser based · no install · reads no game data',
    '标定 → 计划 → 每天十五分钟':'Calibrate → plan → fifteen minutes a day',
    'by':'by','开始':'START','建议使用 Chrome 或 Edge':'Chrome or Edge recommended',
    '软件清单':'TOOLS',
    '灵敏度标定 · 过冲法':'Calibrator · overshoot',
    '测出你每次甩动偏多少，反推应该填的 sensitivity。':'Measures how far each flick lands from the target and derives the sensitivity to use.',
    '甩枪训练 · 自适应随机':'Flick trainer · adaptive',
    '球与限时按 85% 成功率自动调节，主练模式。':'Ball size and time limit adapt to an 85% success rate. Main practice mode.',
    '甩枪训练 · 定角重复':'Flick trainer · blocked',
    '同一角度连打 8 球，形成运动程序，热身用。':'Same angle eight times, alternating on four axes. Warm-up.',
    '甩枪训练 · 小球精度':'Flick trainer · precision',
    '0.7° 小球，无时限，练一次定位的精度。':'0.7° ball, no time limit. Landing precision.',
    '四周训练计划':'Four-week programme',
    '按天推进，自动记录进度与数据。':'Day by day, with progress tracking.',
    '原始输入记录器':'Raw input recorder',
    'C# 单文件，验证真实回报率与报告间隔抖动。':'Single-file C# tool to verify polling rate and report jitter.',
    '方法论':'Methodology','训练方案':'Training plan','训练计划':'Plan','反馈':'Feedback',
    '版本 build':'build','版本 build 2026-11-22 · 9':'build 2026-11-22 · 9',
    '请用电脑打开（建议 Chrome / Edge）·':'Open on desktop (Chrome / Edge) ·',
    '复制链接':'Copy link',
    '关闭':'Close',
    '已复制':'Copied'
};
EN['大肥鱼'] = 'Big Fish';
EN['瞄准，度量'] = 'aim, measured';

(function () {
  'use strict';
  var cur = document.currentScript;
  var ROOT = (cur && cur.src) ? cur.src.replace(/assets\/page-index\.js.*$/, '') : '';
  if (ROOT && ROOT.charAt(ROOT.length - 1) !== '/') ROOT += '/';

  /* 1 · 注册词典：外壳负责翻译 / 状态 / 存储 / 标题 */
  try{ VernierShell.i18n.register(EN); }catch(e){}

  /* 2 · 剪贴板兜底：writeText 在失焦/无权限时抛 NotAllowedError，降级到 execCommand */
  (function(){
    try{
      var c = navigator.clipboard;
      if (!c || !c.writeText) return;
      var orig = c.writeText.bind(c);
      c.writeText = function(t){
        var p = orig(t);
        if (p && p.catch) p.catch(function(){
          var ta = document.createElement('textarea');
          ta.value = t; ta.setAttribute('readonly', '');
          ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0';
          document.body.appendChild(ta);
          ta.select(); ta.setSelectionRange(0, ta.value.length);
          var ok = false; try{ ok = document.execCommand('copy'); }catch(e){}
          ta.remove();
          if (!ok){ try{ window.prompt('复制失败，请手动复制：', t); }catch(e){} }
        });
        return p;
      };
    }catch(e){}
  })();

  /* 3 · 彩蛋：页脚公式连点 3 次 → 对话记录 */
  (function(){
    var f = document.getElementById('eggFormula');
    if (!f) return;
    var n = 0, timer = null;
    f.style.cursor = 'pointer';
    f.addEventListener('click', function(){
      n++; clearTimeout(timer);
      timer = setTimeout(function(){ n = 0; }, 900);
      if (n >= 3){ n = 0; location.href = ROOT + '对话记录.html'; }
    });
  })();

  /* 4 · 彩蛋：版本号连点 7 次 → 小肥鱼 */
  (function(){
    var t = document.getElementById('buildTag');
    if (!t) return;
    var n = 0, timer = null;
    t.addEventListener('click', function(e){
      e.preventDefault(); n++; clearTimeout(timer);
      timer = setTimeout(function(){ n = 0; }, 2500);
      if (n >= 7){ n = 0; location.href = ROOT + '小肥鱼.html'; }
    });
  })();

  /* 5 · 手机提示条：触屏且小屏时显示，复制链接 */
  (function(){
    var tip = document.getElementById('mobileTip');
    if (!tip) return;
    if (!(('ontouchstart' in window) || navigator.maxTouchPoints > 0) || Math.min(screen.width, screen.height) >= 900) return;
    tip.style.display = 'flex';
    var btn = document.getElementById('mtCopy');
    var isEn = function(){ return document.documentElement.getAttribute('lang') === 'en'; };
    if (btn) btn.addEventListener('click', function(){
      try{ navigator.clipboard.writeText(location.href).catch(function(){}); }catch(e){}
      btn.textContent = isEn() ? 'Copied' : '已复制';
      setTimeout(function(){ btn.textContent = isEn() ? 'Copy link' : '复制链接'; }, 2000);
    });
    var close = document.getElementById('mtClose');
    if (close) close.addEventListener('click', function(){ try{ localStorage.setItem('cs2at.mtClosed', '1'); }catch(e){} tip.style.display = 'none'; });
    try{ if (localStorage.getItem('cs2at.mtClosed') === '1') tip.style.display = 'none'; }catch(e){}
  })();
})();
