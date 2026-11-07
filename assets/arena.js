/* assets/arena.js — Vernier 共享竞技场背景（纯 canvas 2D · 无依赖 · 只画背景）
   给 tools/tracking-calibrator.html / tools/openloop-calibrator.html /
   tools/sensitivity-calibrator-strict.html 共用；视觉语言与 tools/aim-trainer.html 的
   「氛围场地」（光 + 雾 + 剪影）保持一致。

   画面构成（全部一次性烘焙进离屏画布，运行时只做 drawImage）：
     1) 天幕：顶部 → 地平线渐变（由 SC.bg / SC.major / SC.dark 推导）
     2) 方向光：顶部弥散光晕 + 地面光池（暗色宽 / 浅色窄）
     3) 地面：透视网格（近处保留，中远景用固定种子随机断裂）
     4) 2–3 层多正弦剪影：低对比、轻微视差（随 setView 的 yaw 平移）
     5) 地平线雾带：把天与地柔和接上
     6) 暗角 + 极淡颗粒
   draw() 每帧固定 6 次 drawImage：
     天幕+地面+网格+光晕(1) + 剪影×3 + 雾带(1) + 暗角颗粒(1)

   颜色：全部从 SC（assets/scenes.js）推导；白 / 黑只作混色端点，不写死场景色。
   兼容：SC.dark=true 走暗色配方；false 走浅色配方（远处压暗、剪影更深、光池更窄）。

   用法：
     <script src="../assets/scenes.js"></script>
     <script src="../assets/arena.js"></script>
     ...
     const arena = Arena.create(cv, { scene: SC });
     function resize(){ …canvas 尺寸… arena.resize(); }
     function loop(now){ … arena.setView(yaw, pitch, f); arena.draw(now); …球 / 准星… }

   只画背景：不画球 / 准星 / 判定 / 统计，也不读页面状态（相机由 setView 传入）。
   未开始时用 drawStart()（或直接 draw()）画静态帧即可。
*/
(function (global) {
  'use strict';

  /* ---------- 小型工具 ---------- */
  var SEED = 0x5eed1997;
  var WHITE = [255, 255, 255], BLACK = [0, 0, 0];

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function mix(a, b, t) {
    t = clamp(t, 0, 1);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function shade(c, d) { return [clamp(c[0] + d, 0, 255), clamp(c[1] + d, 0, 255), clamp(c[2] + d, 0, 255)]; }
  function css(c, a) {
    return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' +
      (a === undefined ? 1 : Math.round(a * 1000) / 1000) + ')';
  }
  function parseColor(c) {
    if (typeof c !== 'string') return null;
    var s = c.trim();
    if (!s) return null;
    if (s.charAt(0) === '#') {
      var h = s.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
      var n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (!m) return null;
    return [clamp(+m[1], 0, 255), clamp(+m[2], 0, 255), clamp(+m[3], 0, 255)];
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mkCv(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.floor(w));
    c.height = Math.max(1, Math.floor(h));
    return c;
  }
  /* 离屏层是否可用：drawImage 只接受真实 canvas，且要求非空尺寸 */
  function isCv(c) {
    return !!c && typeof c.getContext === 'function' && c.width > 0 && c.height > 0;
  }

  /* ---------- 场景配色（全部由 SC 推导） ---------- */
  function palette(SC) {
    var bg = parseColor(SC.bg) || [0, 0, 0];
    var ui = parseColor(SC.ui || SC.cross || SC.major) || bg;
    var major = parseColor(SC.major) || mix(bg, ui, 0.5);
    var dark = !!SC.dark;
    var p = { dark: dark, bg: bg, ui: ui };
    if (dark) {
      p.skyTop   = mix(shade(bg, -5), ui, 0.05);
      p.skyMid   = mix(shade(bg, 6), ui, 0.10);
      p.horizon  = mix(shade(bg, 20), ui, 0.22);
      p.fog      = mix(shade(bg, 26), ui, 0.18);
      p.groundFar = mix(p.horizon, bg, 0.42);
      p.groundNear = shade(bg, 14);
      p.beam     = mix(ui, WHITE, 0.55);
      p.pool     = mix(ui, WHITE, 0.45);
      p.ridge    = mix(bg, BLACK, 0.52);
      p.grid     = mix(major, WHITE, 0.10);
      p.vig      = BLACK;
      p.vigA     = 0.42;
      p.grain    = 0.10;
    } else {
      /* 「晨雾」：冷灰蓝天顶 → 暖白地平线带 → 压暗远地面 → 暖灰近地面，剪影是全画面最暗的一层。
         亮度层级（简明均值 RGB/255）：天顶 ≈0.46–0.53、地平线 ≈0.86–0.88、
         远地面 ≈0.61、近地面 ≈0.73–0.74、剪影 ≈0.39（渲染后行均值约 0.5）。 */
      p.warm     = [Math.min(255, bg[0] + 8), Math.min(255, bg[1] + 4), Math.max(0, bg[2] - 16)];
      p.skyTop   = mix(shade(bg, -128), ui, 0.30);            // 冷灰蓝
      p.horizon  = mix(shade(p.warm, -40), WHITE, 0.53);      // 暖白（≈0.90，被雾带压到实测 0.84 左右）
      p.skyMid   = mix(p.skyTop, p.horizon, 0.50);
      p.fog      = mix(p.warm, WHITE, 0.30);                  // 暖白雾
      p.groundFar = shade(p.warm, -85);                       // ≈0.61 压暗
      p.groundNear = shade(p.warm, -47);                      // ≈0.76 暖灰（实测行均值 ≈0.73）
      p.beam     = mix(WHITE, p.horizon, 0.30);
      p.pool     = mix(WHITE, p.warm, 0.30);
      p.ridge    = shade(p.warm, -158);                       // ≈0.32 全画面最暗的一层
      p.grid     = mix(bg, BLACK, 0.60);
      p.vig      = mix(bg, BLACK, 0.62);
      p.vigA     = 0.08;                                      // 暗角 ≤0.10
      p.grain    = 0.05;                                      // 颗粒 ≤0.10
    }
    // 地平线高度（×H）：固定 0.500 —— pitch=0 时视线水平，地平线必须落在画面正中（否则隐含常驻俯仰角）。
    // 暗色 / 浅色一致；浅色只调剪影高度，不动地平线。
    p.horFrac = 0.50;
    return p;
  }

  /* ---------- 几何 / 配方常量 ---------- */
  var GEO = {
    marginFrac: 0.42,                  // 天幕上下烘焙留白 ×H（pitch 平移余量）
    ridgeHFrac: [0.165, 0.115, 0.075], // 三层剪影高度 ×H（远 → 近）
    ridgeDarkA: [0.30, 0.38, 0.46],    // 暗色剪影顶部不透明度（远 → 近）
    ridgeLightA: [0.86, 0.93, 0.98],   // 浅色剪影顶部不透明度（远处更深、更实）
    ridgeHFracLight: [0.20, 0.14, 0.10], // 浅色剪影更高，保证 y=40% 行基本落在剪影里
    ridgePar: [0.018, 0.034, 0.055],   // 视差（×W / rad，远 → 近）
    maxYaw: 2.2,                       // 剪影烘焙预留的最大视差角（rad）
    fogHFrac: [0.42, 0.40],            // 雾带高度 ×H（暗 / 浅）
    fogYOffFrac: 0.04,                 // 浅色雾带相对地平线的下移 ×H
    poolR: [0.42, 0.24],               // 光池半径 ×W（暗 / 浅）
    poolSY: [0.44, 0.21],              // 光池纵向压扁（浅色更扁，压在下 40% 内）
    poolY: [0.42, 0.62],               // 光池中心（地平线以下地面高度的比例；浅色 ≈0.79H）
    poolA: [0.26, 0.13],               // 光池强度（浅色提亮 ≈3%，≤6%）
    fogLightA: 0.14                    // 浅色雾带峰值
  };

  /* ---------- 天幕 + 地面 + 方向光 + 地面网格（一张离屏） ---------- */
  function buildSky(st) {
    var p = st.pal, Wb = st.Wb, Hb = st.Hb, hor = st.horB;
    var cv = mkCv(Wb, Hb);
    var g = cv.getContext('2d');
    if (!g) return null;

    // 1) 天幕：顶部 → 地平线（暗色保持原配方；浅色「晨雾」用明显的亮度层级）
    var sky = g.createLinearGradient(0, 0, 0, hor);
    if (p.dark) {
      sky.addColorStop(0, css(p.skyTop));
      sky.addColorStop(0.40, css(mix(p.skyTop, p.skyMid, 0.80)));
      sky.addColorStop(0.74, css(mix(p.skyMid, p.horizon, 0.60)));
      sky.addColorStop(1, css(p.horizon));
    } else {
      // 天顶冷灰蓝保持到 52%，最后 20% 快速拉到暖白地平线带
      sky.addColorStop(0, css(p.skyTop));
      sky.addColorStop(0.52, css(mix(p.skyTop, p.horizon, 0.02)));
      sky.addColorStop(0.78, css(mix(p.skyTop, p.horizon, 0.30)));
      sky.addColorStop(0.92, css(mix(p.skyTop, p.horizon, 0.72)));
      sky.addColorStop(1, css(p.horizon));
    }
    g.fillStyle = sky;
    g.fillRect(0, 0, Wb, hor + 1);

    // 2) 顶部弥散光晕（方向光）
    var groundH = Hb - hor;
    var beamR = Math.max(Wb * 0.74, groundH * 1.5);
    g.save();
    g.translate(Wb * 0.5, hor - groundH * 0.62);
    g.scale(1, 1.8);
    var beam = g.createRadialGradient(0, 0, 0, 0, 0, beamR);
    beam.addColorStop(0, css(p.beam, p.dark ? 0.18 : 0.05));
    beam.addColorStop(0.35, css(p.beam, p.dark ? 0.072 : 0.022));
    beam.addColorStop(0.70, css(p.beam, p.dark ? 0.024 : 0.009));
    beam.addColorStop(1, css(p.beam, 0));
    g.fillStyle = beam;
    g.fillRect(-beamR, -beamR, beamR * 2, beamR * 2);
    g.restore();

    // 3) 地面：地平线 → 底部（远 → 近）
    var gg = g.createLinearGradient(0, hor, 0, Hb);
    if (p.dark) {
      gg.addColorStop(0, css(mix(p.horizon, p.groundFar, 0.35)));
      gg.addColorStop(0.22, css(p.groundFar));
      gg.addColorStop(0.62, css(mix(p.groundFar, p.groundNear, 0.75)));
      gg.addColorStop(1, css(p.groundNear));
    } else {
      // 晨雾：梯度按「屏幕可见地面」铺（烘焙图上下留白不能算进可见高度）
      var gf = clamp((st.H * st.S * (1 - st.horFrac)) / Math.max(1, groundH), 0, 1);
      gg.addColorStop(0, css(mix(p.horizon, p.groundFar, 0.10)));
      gg.addColorStop(0.06 * gf, css(mix(p.horizon, p.groundFar, 0.30)));
      gg.addColorStop(0.25 * gf, css(p.groundFar));
      gg.addColorStop(0.62 * gf, css(mix(p.groundFar, p.groundNear, 0.75)));
      gg.addColorStop(gf, css(p.groundNear));
      gg.addColorStop(1, css(p.groundNear));
    }
    g.fillStyle = gg;
    g.fillRect(0, hor, Wb, groundH + 1);

    // 3.5) 地平线：一道极淡的压暗线，画在地平线上侧 1px（行 449 于 900 高）——
    // 地面从 450 行开始，保证「地平线行 = 450」的几何不被 2px 线带宽模糊
    var lw = Math.max(1, Math.round(st.S));
    g.fillStyle = css(mix(p.horizon, BLACK, 0.60), p.dark ? 0.30 : 0.16);
    g.fillRect(0, hor - lw, Wb, lw);

    // 4) 地面光池（暗色宽、居中；浅色收窄、更靠前）
    var idx = p.dark ? 0 : 1;
    var prx = Wb * GEO.poolR[idx];
    var pry = prx * GEO.poolSY[idx];
    // 暗色沿用原式（像素级不变）；浅色按「屏幕可见地面」定位，保证光池只落在画面下 40%
    var pcy = p.dark ? (hor + groundH * GEO.poolY[0])
                     : (hor + st.H * st.S * (1 - st.horFrac) * GEO.poolY[1]);
    g.save();
    g.translate(Wb * 0.5, pcy);
    g.scale(1, pry / prx);
    var pg = g.createRadialGradient(0, 0, 0, 0, 0, prx);
    pg.addColorStop(0, css(p.pool, GEO.poolA[idx]));
    pg.addColorStop(0.45, css(p.pool, GEO.poolA[idx] * 0.40));
    pg.addColorStop(1, css(p.pool, 0));
    g.fillStyle = pg;
    g.fillRect(-prx, -prx, prx * 2, prx * 2);
    g.restore();

    // 5) 透视地面网格：近处保留，中远景固定种子随机断裂
    drawGroundGrid(g, p, Wb, Hb, hor);
    return cv;
  }

  function drawGroundGrid(g, p, Wb, Hb, hor) {
    var rnd = mulberry32(SEED);
    var groundH = Hb - hor;
    var vpx = Wb * 0.5;
    var nearA = p.dark ? 0.30 : 0.22;
    g.save();
    g.lineWidth = 1;
    g.lineCap = 'butt';

    // 纵向：从底边汇聚到消失点。cols 必须为偶数，消失点才正好落在 W/2（中心竖轴 = 准星列）
    var cols = 16;                        // 偶数
    var segN = 11;
    for (var i = 0; i <= cols; i++) {
      var bx = Wb * (i / cols);
      var px = bx, py = Hb;
      for (var s = 1; s <= segN; s++) {
        var t = s / (segN + 1.6);            // 0 → ≈0.86 的深度
        var nx = bx + (vpx - bx) * t;
        var ny = Hb + (hor - Hb) * t;
        var broken = t > 0.62 ? rnd() < 0.45 : (t > 0.34 ? rnd() < 0.16 : false);
        if (!broken) {
          g.strokeStyle = css(p.grid, nearA * (1 - t * 0.82));
          g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
        }
        px = nx; py = ny;
      }
    }

    // 中心竖轴：从底边到消失点的竖直线，必须穿过准星（x = 0.5W）。
    // 单独绘制且永不断裂；+0.5 落到像素中心，1px 线正好占 x=W/2 那一列。
    var cxAxis = Math.floor(Wb * 0.5) + 0.5;
    g.strokeStyle = css(p.grid, Math.min(1, nearA * 1.15));
    g.beginPath();
    g.moveTo(cxAxis, Hb);
    g.lineTo(cxAxis, Math.min(hor + 1, Hb - 1));
    g.stroke();

    // 横向：越靠近地平线越密；中远景随机断裂
    var rows = 9;
    for (var k = 0; k < rows; k++) {
      var y = hor + groundH * Math.pow((k + 1) / rows, 2.05);
      var depth = clamp((y - hor) / Math.max(1, groundH), 0, 1);   // 0 远 → 1 近
      if (k < rows * 0.5 && rnd() < 0.34) continue;                // 远处整条断裂
      var a = nearA * (0.30 + 0.70 * depth);
      g.strokeStyle = css(p.grid, a);
      g.beginPath();
      var chunks = 12, chunkW = Wb / chunks;
      for (var c = 0; c < chunks; c++) {
        if (depth < 0.62 && rnd() < 0.30) continue;
        g.moveTo(c * chunkW, y);
        g.lineTo((c + 1) * chunkW, y);
      }
      g.stroke();
    }
    g.restore();
  }

  /* ---------- 剪影层（多正弦；烘焙时预留视差余量） ---------- */
  function buildRidge(st, i) {
    var p = st.pal, dark = p.dark;
    var hfArr = dark ? GEO.ridgeHFrac : GEO.ridgeHFracLight;
    var HD = Math.max(18, Math.floor(st.H * hfArr[i]));
    var parPx = st.W * GEO.ridgePar[i];
    var marginPx = parPx * GEO.maxYaw;
    var CWd = Math.floor(st.W + 2 * marginPx);
    var RS = st.S * 0.5;                    // 剪影平滑，半分辨率足够
    var cv = mkCv(CWd * RS, HD * RS);
    var g = cv.getContext('2d');
    if (!g) return null;
    var w2 = cv.width, h2 = cv.height;
    var aTop = dark ? GEO.ridgeDarkA[i] : GEO.ridgeLightA[i];
    var grd = g.createLinearGradient(0, 0, 0, h2);
    grd.addColorStop(0, css(p.ridge, aTop));
    if (dark) {
      grd.addColorStop(0.55, css(p.ridge, aTop * 0.62));
      grd.addColorStop(1, css(p.ridge, 0));
    } else {
      // 晨雾：剪影不能到山脚就淡没，否则会被亮地平线冲淡——底部保留一点实度，交给雾带柔化
      grd.addColorStop(0.60, css(p.ridge, aTop * 0.82));
      grd.addColorStop(0.88, css(p.ridge, aTop * 0.46));
      grd.addColorStop(1, css(p.ridge, aTop * 0.18));
    }
    g.fillStyle = grd;

    var f1 = 1.6 * (i + 1) + 0.9, f2 = 4.1 * (i + 1) + 1.7;
    var f3 = 9.3 * (i + 1) + 0.4, f4 = 17.1 * (i + 1) + 2.2;
    var p1 = i * 2.1 + 0.6, p2 = i * 3.7 + 1.2, p3 = i * 1.3 + 2.4, p4 = i * 5.3 + 0.9;
    var base = 0.52 + 0.11 * i;
    var stepX = Math.max(1, Math.floor(w2 / 480));

    g.beginPath(); g.moveTo(0, h2);
    for (var x = 0; x <= w2; x += stepX) {
      var t = (x / w2) * Math.PI * 2;
      var v = 0.56 + 0.23 * Math.sin(t * f1 + p1) + 0.12 * Math.sin(t * f2 + p2) +
              0.06 * Math.sin(t * f3 + p3) + 0.03 * Math.sin(t * f4 + p4);
      g.lineTo(x, h2 - h2 * clamp(v * base, 0.14, 0.98));
    }
    g.lineTo(w2, h2); g.closePath(); g.fill();
    return { cv: cv, w: CWd, h: HD, par: parPx, scale: RS };
  }

  /* ---------- 地平线雾带 ---------- */
  function buildFog(st) {
    var p = st.pal, dark = p.dark;
    var Hf = Math.max(48, Math.floor(st.H * (dark ? GEO.fogHFrac[0] : GEO.fogHFrac[1])));
    var cv = mkCv(st.W * st.S, Hf * st.S);
    var g = cv.getContext('2d');
    if (!g) return null;
    var w2 = cv.width, h2 = cv.height;
    var grd = g.createLinearGradient(0, 0, 0, h2);
    if (dark) {
      grd.addColorStop(0, css(p.fog, 0));
      grd.addColorStop(0.18, css(p.fog, 0.14));
      grd.addColorStop(0.38, css(p.fog, 0.34));
      grd.addColorStop(0.50, css(p.fog, 0.44));
      grd.addColorStop(0.62, css(p.fog, 0.34));
      grd.addColorStop(0.82, css(p.fog, 0.14));
      grd.addColorStop(1, css(p.fog, 0));
    } else {
      grd.addColorStop(0, css(p.fog, 0));
      grd.addColorStop(0.20, css(p.fog, 0.05));
      grd.addColorStop(0.42, css(p.fog, 0.10));
      grd.addColorStop(0.62, css(p.fog, GEO.fogLightA));
      grd.addColorStop(0.82, css(p.fog, 0.10));
      grd.addColorStop(1, css(p.fog, 0.02));
    }
    g.fillStyle = grd;
    g.fillRect(0, 0, w2, h2);
    return { cv: cv, h: Hf };
  }

  /* ---------- 暗角 + 极淡颗粒（烘焙成一张半分辨率图） ---------- */
  function buildOverlay(st) {
    var p = st.pal;
    var ovS = st.S * 0.5;
    var vw = Math.max(2, Math.floor(st.W * ovS));
    var vh = Math.max(2, Math.floor(st.H * ovS));
    var cv = mkCv(vw, vh);
    var g = cv.getContext('2d');
    if (!g) return null;
    var img;
    try { img = g.createImageData(vw, vh); } catch (e) { return null; }
    var px = img.data;
    var cx = (vw - 1) * 0.5, cy = (vh - 1) * 0.5;
    var inv = 1 / Math.sqrt(cx * cx + cy * cy);
    var maxA = p.vigA, grain = p.grain;
    var rnd = mulberry32(SEED ^ 0x9e3779b9);
    var r = Math.round(p.vig[0]), gg2 = Math.round(p.vig[1]), b = Math.round(p.vig[2]);
    for (var y = 0; y < vh; y++) {
      var dy = (y - cy) * inv;
      for (var x = 0; x < vw; x++) {
        var dx = (x - cx) * inv;
        var t = (Math.sqrt(dx * dx + dy * dy) - 0.34) / 0.66;
        if (t < 0) t = 0;
        var a = t * t * maxA + (rnd() - 0.5) * grain * t;
        if (a < 0) a = 0; else if (a > 1) a = 1;
        var o = (y * vw + x) * 4;
        px[o] = r; px[o + 1] = gg2; px[o + 2] = b; px[o + 3] = (a * 255) | 0;
      }
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  /* ---------- 实例 ---------- */
  function create(canvas, opts) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new Error('Arena.create: canvas 2D element required');
    }
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var st = {
      cv: canvas, ctx: ctx, SC: opts.scene || {},
      W: 0, H: 0, S: 1, vb: 1,
      dirty: true, ready: false,
      yaw: 0, pitch: 0, f: 0
    };
    st.pal = palette(st.SC);

    function clear() {
      st.skyCv = null; st.fogCv = null; st.overlayCv = null;
      st.ridges = [null, null, null];
      st.ready = false;
    }

    /* 兜底：任何烘焙层不可用时只铺一层场景底色（绝不让 undefined 进 drawImage） */
    function solidBg() {
      var c = st.ctx, W = st.W, H = st.H;
      if (!c || !(W > 0) || !(H > 0)) return;
      try { c.restore(); } catch (e) {}
      c.fillStyle = css(st.pal.bg);
      c.fillRect(0, 0, W, H);
    }

    function build() {
      var W = st.W, H = st.H;
      if (!(W > 0) || !(H > 0)) { clear(); return; }
      try {
        st.S = Math.min(1, 1600 / W);                 // 烘焙像素上限：宽 ≤ 1600
        var M = st.marginD = H * GEO.marginFrac;      // 天幕上下留白
        st.Wb = Math.max(2, Math.floor(W * st.S));
        st.Hb = Math.max(2, Math.floor((H + 2 * M) * st.S));
        st.horFrac = st.pal.horFrac != null ? st.pal.horFrac : 0.5;
        st.horB = (M + H * st.horFrac) * st.S;        // 烘焙图里的地平线
        st.skyCv = buildSky(st);
        st.ridges = [buildRidge(st, 0), buildRidge(st, 1), buildRidge(st, 2)];
        st.fogCv = buildFog(st);
        st.overlayCv = buildOverlay(st);
        st.ready = isCv(st.skyCv) && isCv(st.overlayCv);
      } catch (e) {
        clear();                                      // 烘焙失败：清掉半成品，画纯色兜底
      }
      st.dirty = false;
    }

    var api = {
      canvas: canvas,

      resize: function () {
        st.W = canvas.width | 0;
        st.H = canvas.height | 0;
        clear();                 // 尺寸变了：旧烘焙层立即作废（不跨帧引用），下一帧重建
        st.dirty = true;
      },

      setView: function (yaw, pitch, f) {
        if (typeof yaw === 'number' && isFinite(yaw)) st.yaw = yaw;
        if (typeof pitch === 'number' && isFinite(pitch)) st.pitch = pitch;
        if (typeof f === 'number' && isFinite(f) && f > 0) st.f = f;
      },

      /* 每帧：只画背景，3–6 次 drawImage（正常 6 次）。
         每层先判存在 + 尺寸，烘焙失败 / resize 后未重建时只画纯色兜底，绝不 throw。 */
      draw: function (now) {
        if (st.dirty || !st.ready) build();
        var c = st.ctx, W = st.W, H = st.H, S = st.S;
        if (!(W > 0) || !(H > 0) || !c) return 0;
        if (!st.ready) { solidBg(); return 0; }
        var draws = 0;
        try {
          var f = st.f > 0 ? st.f : W * 0.5;
          var M = st.marginD;
          var off = clamp(f * Math.tan(clamp(st.pitch, -1.2, 1.2)), -M, M);
          var hf = st.horFrac != null ? st.horFrac : 0.5;
          var hy = H * hf + off;

          c.save();
          c.imageSmoothingEnabled = true;

          // 1) 天幕 + 地面 + 网格 + 光晕（按 pitch 源裁剪，不露边）
          var srcH = Math.min(st.Hb, Math.floor(H * S));
          var srcY = clamp(Math.floor((M - off) * S), 0, Math.max(0, st.Hb - srcH));
          var srcW = Math.floor(W * S);
          if (isCv(st.skyCv) && srcW > 0 && srcH > 0) {
            c.drawImage(st.skyCv, 0, srcY, srcW, srcH, 0, 0, W, H);
            draws++;
          }

          // 2–4) 三层剪影：随 yaw 轻微视差
          for (var i = 0; i < st.ridges.length; i++) {
            var rd = st.ridges[i];
            if (!rd || !isCv(rd.cv) || !(rd.h > 0)) continue;
            var winW = Math.floor(W * rd.scale);
            if (!(winW > 0)) continue;
            var srcX = clamp(Math.floor((rd.w - W) * rd.scale * 0.5 + st.yaw * rd.par * rd.scale),
              0, Math.max(0, rd.cv.width - winW));
            c.drawImage(rd.cv, srcX, 0, winW, rd.cv.height, 0, hy - rd.h, W, rd.h);
            draws++;
          }

          // 5) 地平线雾带（浅色整体下移，压在地面附近）
          var fog = st.fogCv;
          if (fog && isCv(fog.cv) && fog.h > 0) {
            var fy = hy - fog.h * 0.5 + (st.pal.dark ? 0 : GEO.fogYOffFrac * H);
            c.drawImage(fog.cv, 0, fy, W, fog.h);
            draws++;
          }

          // 6) 暗角 + 颗粒
          if (isCv(st.overlayCv)) {
            c.drawImage(st.overlayCv, 0, 0, W, H);
            draws++;
          }

          c.restore();
          return draws;
        } catch (e) {
          solidBg();
          clear();                 // 出错即作废缓存，下一帧重建
          st.dirty = true;
          return 0;
        }
      },

      /* 开始页：静态一帧（与 draw 同一套层，可自行降频调用） */
      drawStart: function (now) { return this.draw(now || 0); },

      /* 把 --overlay 调成半透明，让开始页 / 暂停页背后透出竞技场（与训练器一致）。
         同时给出开始页局部 scrim 变量：只压中间文案带，不整体加暗（天空 / 地面保持通透）。 */
      tintOverlay: function (root) {
        try {
          var p = st.pal;
          var a = p.dark ? 0.40 : 0.34;
          var el = root || (typeof document !== 'undefined' ? document.documentElement : null);
          if (!el) return;
          el.style.setProperty('--overlay', css(p.bg, a));
          // 材质用：深色场地 = 高光 .28 / 接触阴影 .55（assets/ui-material.css 读取）
          el.setAttribute('data-arena-dark', p.dark ? '1' : '0');
          // 开始页文案区局部 scrim（与 tools/aim-trainer.html 同款变量与配方）：
          // 浅色 = SC.bg 暖白 0.55、暗色 = SC.bg 暗色 0.35；只盖中间带，天空/地面保持通透
          var peak = p.dark ? 0.35 : 0.55;
          el.style.setProperty('--scrim-rgb',
            Math.round(p.bg[0]) + ',' + Math.round(p.bg[1]) + ',' + Math.round(p.bg[2]));
          el.style.setProperty('--scrim-a', String(peak));
        } catch (e) {}
      },

      destroy: function () { clear(); st.ctx = null; }
    };

    api.tintOverlay();
    st.W = canvas.width | 0;
    st.H = canvas.height | 0;
    return api;
  }

  var Arena = { create: create, version: '1.0.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = Arena;
  global.Arena = Arena;
})(typeof window !== 'undefined' ? window : this);
