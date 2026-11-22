/* 语言切换：雨滴涟漪过渡（全站唯一允许「等」的地方）
   用法： LangRipple.run({x,y}, function(){ 换成新语言 })
   - 圆心 = 点击位置；主波 620ms ease-out；3 圈拖尾
   - 期间拦截点击；reduced-motion 直接切换
*/
(function () {
  var REDUCE = false;
  try { REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function cssVar(name, fb) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fb;
    } catch (e) { return fb; }
  }

  function run(point, swap) {
    if (REDUCE) { try { swap(); } catch (e) {} return; }
    var x = point && isFinite(point.x) ? point.x : innerWidth / 2;
    var y = point && isFinite(point.y) ? point.y : innerHeight / 2;
    var rMax = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) * 1.05;
    var acc = cssVar('--acc', cssVar('--acc-paper', '#c2410c'));
    var line = cssVar('--rule', cssVar('--rule-d', 'rgba(0,0,0,.2)'));
    var dark = document.documentElement.getAttribute('data-theme');
    var isDark = dark && /night|forest|jade|ink|mono|cyber|dark/.test(dark);
    var bg = isDark ? cssVar('--dark', '#0b0f14') : cssVar('--paper', '#f4efe4');

    var host = document.createElement('div');
    host.setAttribute('data-lang-ripple', '');
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:auto;overflow:hidden;';

    // 波纹环（主波 + 3 圈拖尾）
    var rings = [];
    for (var i = 0; i < 4; i++) {
      var el = document.createElement('div');
      var isMain = i === 0;
      el.style.cssText = 'position:absolute;left:0;top:0;border-radius:50%;' +
        'border:' + (isMain ? 1.2 : 1) + 'px solid ' + (isMain ? acc : line) + ';' +
        'opacity:' + (isMain ? .95 : [0, .30, .20, .12][i]) + ';' +
        'will-change:transform,opacity;transform:translate(-50%,-50%) scale(0);';
      host.appendChild(el);
      rings.push(el);
    }

    // 顶层覆盖片：用 clip-path 圆形把「新页面」盖住，避免切换瞬间看到旧内容
    var veil = document.createElement('div');
    veil.style.cssText = 'position:absolute;inset:0;background:' + bg + ';opacity:0;';
    host.appendChild(veil);

    document.body.appendChild(host);

    var t0 = performance.now();
    var DUR = 620;
    var swapped = false;

    function frame(now) {
      var t = (now - t0) / DUR;
      var e = 1 - Math.pow(1 - Math.min(1, t), 3); // ease-out

      var r = e * rMax;
      // 用真实宽高画环（不用 scale）：scale 会把 1px 描边一起放大，半径大时变成粗光带
      rings[0].style.width = rings[0].style.height = (r * 2) + 'px';
      rings[0].style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';

      // 拖尾：延迟 110/210/320ms，速度递减
      for (var i = 1; i < 4; i++) {
        var d = [0, 110, 210, 320][i];
        var tt = Math.max(0, (now - t0 - d)) / DUR;
        var ee = 1 - Math.pow(1 - Math.min(1, tt), 3);
        var rr = ee * rMax * [1, .88, .82, .76][i];
        rings[i].style.width = rings[i].style.height = (rr * 2) + 'px';
        rings[i].style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
        rings[i].style.opacity = String([0, .30, .20, .12][i] * (1 - Math.min(1, t)));
      }

      // 波前遮住大半时切换语言
      if (!swapped && t >= .45) { swapped = true; try { swap(); } catch (e) {} }
      // 覆盖片上浮：切换后 480ms 开始淡出
      if (t > .78) {
        veil.style.opacity = String(Math.min(1, (t - .78) / .22) * .0);
        host.style.opacity = String(1 - Math.min(1, (t - .78) / .22));
      }

      if (t < 1.05) requestAnimationFrame(frame);
      else { try { host.remove(); } catch (e) {} }
    }
    requestAnimationFrame(frame);
  }

  window.LangRipple = { run: run };
})();