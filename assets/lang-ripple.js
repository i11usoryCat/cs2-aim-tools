/* 语言切换：**边擦除边翻译**（原汁原味的「雨滴波纹揭示」）
   核心技术：View Transitions API —— 浏览器自己把「旧页面」和「新页面」各拍一张快照，
   我们用 clip-path 圆形把新快照从点击点揭开，于是文字是一边被擦掉一边变成新语言的。
   不克隆 DOM、不重排，所以不会出现旧方案的重影/错行。
   不支持 View Transitions 时退回「细环涟漪 + 原位切换」。
*/
(function () {
  var REDUCE = false;
  try { REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var CSS_DONE = false;

  function cssVar(name, fb) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fb;
    } catch (e) { return fb; }
  }

  function injectBaseCss() {
    if (CSS_DONE) return; CSS_DONE = true;
    var st = document.createElement('style');
    st.setAttribute('data-lang-vt', '');
    st.textContent = [
      /* 关掉默认交叉淡入，改由我们用圆形 clip 揭示 */
      '::view-transition-old(root){ animation:none !important; mix-blend-mode:normal; }',
      '::view-transition-new(root){ animation:none !important; mix-blend-mode:normal; }',
      '::view-transition-group(root){ animation:none !important; }',
      /* 揭开的那一瞬间不要有背景闪白 */
      '::view-transition-image-pair(root){ isolation:auto; }'
    ].join('');
    document.head.appendChild(st);
  }

  /* 波前细环：只是装饰，跟着圆形半径走 */
  function edgeRings(x, y, rMax, dur, acc, line) {
    var host = document.createElement('div');
    host.setAttribute('data-lang-ripple', '');
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;overflow:hidden;';
    var rings = [];
    for (var i = 0; i < 3; i++) {
      var el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:0;top:0;border-radius:50%;border:' + (i === 0 ? 1.2 : 1) + 'px solid ' +
        (i === 0 ? acc : line) + ';opacity:' + (i === 0 ? .9 : [0, .26, .14][i]) + ';will-change:width,height;';
      host.appendChild(el); rings.push(el);
    }
    document.body.appendChild(host);
    var t0 = performance.now();
    function frame(now) {
      var t = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - t, 3);
      var r = e * rMax;
      rings[0].style.width = rings[0].style.height = (r * 2) + 'px';
      rings[0].style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
      for (var i = 1; i < 3; i++) {
        var d = [0, 120, 240][i];
        var tt = Math.max(0, (now - t0 - d)) / dur;
        var ee = 1 - Math.pow(1 - Math.min(1, tt), 3);
        var rr = ee * rMax * [1, .9, .84][i];
        rings[i].style.width = rings[i].style.height = (rr * 2) + 'px';
        rings[i].style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
        rings[i].style.opacity = String([0, .26, .14][i] * (1 - t));
      }
      if (t < 1) requestAnimationFrame(frame);
      else { try { host.remove(); } catch (e) {} }
    }
    requestAnimationFrame(frame);
  }

  /* 旧路径：细环 + 原位切换（不支持 View Transition 时） */
  function fallbackRun(x, y, rMax, DUR, acc, line, swap) {
    var host = document.createElement('div');
    host.setAttribute('data-lang-ripple', '');
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:auto;overflow:hidden;';
    var swapped = false;
    var t0 = performance.now();
    (function frame(now) {
      var t = (now - t0) / DUR;
      if (!swapped && t >= .5) { swapped = true; try { swap(); } catch (e) {} }
      if (t < 1) requestAnimationFrame(frame);
      else { try { host.remove(); } catch (e) {} }
    })(t0);
    edgeRings(x, y, rMax, DUR, acc, line);
  }

  function run(point, swap) {
    var x = point && isFinite(point.x) ? point.x : innerWidth / 2;
    var y = point && isFinite(point.y) ? point.y : innerHeight / 2;
    var rMax = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) * 1.05;
    var DUR = REDUCE ? 560 : 880;
    var acc = cssVar('--acc', cssVar('--acc-paper', '#c2410c'));
    var line = cssVar('--line', cssVar('--rule-d', 'rgba(0,0,0,.2)'));

    // ① 首选：View Transition 圆形揭示（边擦除边翻译）
    if (!window.__noVT && document.startViewTransition && !REDUCE) {
      try {
        injectBaseCss();
        var vt = document.startViewTransition(function () {
          try { swap(); } catch (e) {}
        });
        vt.ready.then(function () {
          try {
            var anim = document.documentElement.animate(
              { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + rMax + 'px at ' + x + 'px ' + y + 'px)'] },
              { duration: DUR, easing: 'cubic-bezier(.22,.85,.28,1)', fill: 'forwards', pseudoElement: '::view-transition-new(root)' }
            );
            anim.finished.then(function () { try { anim.cancel(); } catch (e) {} }).catch(function () {});
          } catch (e) {}
          edgeRings(x, y, rMax, DUR, acc, line);
        }).catch(function () {});
        vt.finished.catch(function () {});
        return;
      } catch (e) { /* 落到 fallback */ }
    }
    fallbackRun(x, y, rMax, DUR, acc, line, swap);
  }

  window.LangRipple = { run: run, version: '4-vt', lastRun: 0, mode: 'view-transition' };
  var _orig = run;
  window.LangRipple.run = function (p, s) { window.LangRipple.lastRun = Date.now(); return _orig(p, s); };
})();
