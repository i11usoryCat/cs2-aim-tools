/* 花园 · 慢练引擎（garden.html）
   ------------------------------------------------------------------
   三种节奏：呼吸 / 漂流 / 远眺。不计分、不催促、不报告数字。
   技术：单 canvas 2D，所有视觉程序化生成（无外部素材）；
        星星/光点预烘焙到离屏 canvas，每帧只做 drawImage；
        声音用 WebAudio 现场合成（无音频文件），首次交互后才启动。
   约束：reduced-motion 下不漂移、不散发粒子；主题切换后重取色板。
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var cv = document.getElementById('gardenCanvas');
  if (!cv) return;
  var ctx = cv.getContext('2d', { alpha: false });
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var W = 0, H = 0, DPR = 1, HORIZON = 0, F = 1;

  /* ── 指针 ─────────────────────────────────────────────── */
  var P = { x: -999, y: -999, tx: -999, ty: -999, speed: 0, down: false, seen: false };

  /* ── 色板（从主题令牌推导） ─────────────────────────────── */
  var PAL = null;
  function parseColor(v, fb) {
    try {
      v = String(v || '').trim();
      var m = v.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
      if (m) return [+m[1], +m[2], +m[3]];
      var h = v.replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      if (/^[0-9a-fA-F]{6}$/.test(h)) {
        var n = parseInt(h, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
    } catch (e) {}
    return fb;
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function lum(c) { return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
  function css(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a === undefined ? 1 : a) + ')'; }

  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    var acc = parseColor(cs.getPropertyValue('--acc'), [127, 191, 166]);
    var gold = parseColor(cs.getPropertyValue('--gold'), [224, 164, 88]);
    var txt = parseColor(cs.getPropertyValue('--txt'), [236, 240, 238]);
    var bg = parseColor(cs.getPropertyValue('--bg'), [12, 16, 18]);
    // 花园永远是夜色：明亮主题下也保持深色场景，否则目标会白底发光、刺眼。
    var dark = true;
    var base = dark ? mix(bg, [2, 4, 8], 0.55) : mix(bg, [255, 255, 255], 0.35);
    // 梦境基色：固定四色（青 / 玫瑰 / 金 / 靛），主题只做 18% 的微染。
    // 这样任何主题下花园都保持「艳丽但不刺眼」，而不是被主题拉成单色。
    var DREAM = {
      teal:   [58, 190, 186],
      rose:   [232, 118, 158],
      gold:   [246, 190, 120],
      indigo: [78, 86, 175]
    };
    function tint(c) { return mix(c, acc, 0.18); }
    PAL = {
      dark: dark,
      rose: tint(DREAM.rose),
      skyTop: dark ? mix(DREAM.indigo, [8, 8, 22], 0.68) : mix([206, 222, 238], base, 0.35),
      skyMid: dark ? mix(tint(DREAM.teal), [6, 10, 20], 0.52) : mix(tint(DREAM.teal), [240, 246, 248], 0.72),
      skyLow: dark ? mix(tint(DREAM.gold), [10, 12, 18], 0.55) : mix(tint(DREAM.gold), [255, 250, 240], 0.78),
      skyHaze: dark ? mix(tint(DREAM.rose), [12, 10, 22], 0.62) : mix(tint(DREAM.rose), [252, 244, 246], 0.78),
      horizon: dark ? mix(tint(DREAM.gold), [10, 12, 18], 0.30) : mix(tint(DREAM.gold), [255, 252, 246], 0.6),
      hillFar: dark ? mix(tint(DREAM.teal), [10, 16, 24], 0.72) : mix(tint(DREAM.teal), [244, 248, 248], 0.80),
      hillMid: dark ? mix(tint(DREAM.teal), [8, 12, 20], 0.80) : mix(tint(DREAM.teal), [240, 246, 246], 0.86),
      hillNear: dark ? mix([6, 9, 14], base, 0.35) : mix(tint(DREAM.teal), [236, 242, 242], 0.90),
      lake: dark ? mix(tint(DREAM.teal), [6, 10, 16], 0.62) : mix(tint(DREAM.teal), [238, 244, 246], 0.86),
      aurora: [tint(DREAM.teal), tint(DREAM.rose), tint(DREAM.gold)],
      orb: mix(tint(DREAM.gold), [255, 255, 255], dark ? 0.30 : 0.22),
      orbHalo: tint(DREAM.teal),
      orbCore: [255, 252, 240],
      petal: mix(tint(DREAM.rose), tint(DREAM.gold), 0.45),
      star: mix(txt, [255, 255, 255], 0.4),
      line: mix(txt, base, 0.55),
      vignette: dark ? [0, 0, 0] : mix(base, [255, 255, 255], 0.4)
    };
    buildSprites();
  }

  /* ── 预烘焙：星点、光点、暗角 ───────────────────────────── */
  var starCv = null, orbCv = null, haloCv = null, petalCv = null, vigCv = null;
  function mkCanvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(2, w | 0); c.height = Math.max(2, h | 0); return c; }

  function buildSprites() {
    // 星空
    var sw = Math.max(2, Math.round(W * 0.75)), sh = Math.max(2, Math.round(H * 0.75));
    starCv = mkCanvas(sw, sh);
    var sg = starCv.getContext('2d');
    var n = Math.round((W * H) / 14000);
    // 用固定种子，保证同一尺寸下星图稳定
    var seed = 1337;
    function rnd() { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; }
    for (var i = 0; i < n; i++) {
      var x = rnd() * sw, y = rnd() * sh * 0.82;
      var r = 0.35 + rnd() * 1.05;
      var a = 0.10 + rnd() * 0.55;
      sg.fillStyle = css(PAL.star, a);
      sg.beginPath(); sg.arc(x, y, r, 0, Math.PI * 2); sg.fill();
      if (rnd() > 0.93) {
        var gr = sg.createRadialGradient(x, y, 0, x, y, r * 4.2);
        gr.addColorStop(0, css(PAL.star, a * 0.55));
        gr.addColorStop(1, css(PAL.star, 0));
        sg.fillStyle = gr; sg.beginPath(); sg.arc(x, y, r * 4.2, 0, Math.PI * 2); sg.fill();
      }
    }
    // 光点（目标）
    orbCv = mkCanvas(192, 192);
    var og = orbCv.getContext('2d');
    var gr2 = og.createRadialGradient(96, 96, 0, 96, 96, 96);
    gr2.addColorStop(0, css(PAL.orbCore, 1));
    gr2.addColorStop(0.10, css(PAL.orbCore, 0.95));
    gr2.addColorStop(0.22, css(PAL.orb, 0.75));
    gr2.addColorStop(0.46, css(PAL.orb, 0.22));
    gr2.addColorStop(0.72, css(PAL.orb, 0.06));
    gr2.addColorStop(1, css(PAL.orb, 0));
    og.fillStyle = gr2; og.fillRect(0, 0, 192, 192);
    // 青色外晕（无硬边）
    haloCv = mkCanvas(192, 192);
    var hg = haloCv.getContext('2d');
    var hgr = hg.createRadialGradient(96, 96, 0, 96, 96, 96);
    hgr.addColorStop(0, css(PAL.orbHalo, 0.55));
    hgr.addColorStop(0.28, css(PAL.orbHalo, 0.26));
    hgr.addColorStop(0.62, css(PAL.orbHalo, 0.07));
    hgr.addColorStop(1, css(PAL.orbHalo, 0));
    hg.fillStyle = hgr; hg.fillRect(0, 0, 192, 192);
    // 花瓣（柔边椭圆，带一点高光）
    petalCv = mkCanvas(96, 64);
    var pg2 = petalCv.getContext('2d');
    var pgr = pg2.createRadialGradient(48, 32, 1, 48, 32, 46);
    pgr.addColorStop(0, css(mix(PAL.petal, [255, 250, 236], 0.30), 0.80));
    pgr.addColorStop(0.45, css(PAL.petal, 0.55));
    pgr.addColorStop(0.8, css(PAL.petal, 0.14));
    pgr.addColorStop(1, css(PAL.petal, 0));
    pg2.save(); pg2.translate(48, 32); pg2.scale(1, 0.52); pg2.translate(-48, -32);
    pg2.fillStyle = pgr; pg2.beginPath(); pg2.arc(48, 32, 46, 0, Math.PI * 2); pg2.fill();
    pg2.restore();
    // 暗角
    vigCv = mkCanvas(Math.max(2, W >> 1), Math.max(2, H >> 1));
    var vg = vigCv.getContext('2d');
    var vgr = vg.createRadialGradient(W / 4, H / 4, Math.min(W, H) * 0.16, W / 4, H / 4, Math.max(W, H) * 0.62);
    vgr.addColorStop(0, css(PAL.vignette, 0));
    vgr.addColorStop(0.62, css(PAL.vignette, 0.10));
    vgr.addColorStop(1, css(PAL.vignette, PAL.dark ? 0.62 : 0.30));
    vg.fillStyle = vgr; vg.fillRect(0, 0, W >> 1, H >> 1);
  }

  /* ── 场景数据 ─────────────────────────────────────────── */
  var hills = [];
  function buildHills() {
    hills = [];
    var layers = [
      { y: 0.60, amp: 0.055, wl: 1.7, ph: 0.6, col: 'hillFar', a: 0.55 },
      { y: 0.66, amp: 0.038, wl: 2.6, ph: 2.1, col: 'hillMid', a: 0.75 },
      { y: 0.72, amp: 0.022, wl: 4.1, ph: 4.4, col: 'hillNear', a: 0.9 }
    ];
    for (var i = 0; i < layers.length; i++) hills.push(layers[i]);
  }

  var orbs = [], petals = [], rings = [], flies = [];
  var mode = 'breathe';
  var t0 = performance.now();
  var last = t0;
  var breathPhase = 0;      // 0..1，0=呼尽，0.5=吸满
  var nextSpawn = 0;
  var gazeTimer = 0;

  var MODES = {
    breathe: {
      zh: '呼吸', en: 'Breathe',
      hintZh: '吸气时睁眼，呼气时出手。这一局不计分。',
      hintEn: 'Open your eyes on the inhale, strike on the exhale. Nothing is scored.'
    },
    drift: {
      zh: '漂流', en: 'Drift',
      hintZh: '光点一直在漂。想打就打，想停就看。',
      hintEn: 'The lights keep drifting. Strike when you like — or just watch.'
    },
    gaze: {
      zh: '远眺', en: 'Gaze',
      hintZh: '不用点。每二十秒，把视线放到最远的地方。',
      hintEn: 'No clicking. Every twenty seconds, rest your eyes on the farthest point.'
    }
  };

  var I18N = {
    '训练中心': 'Training hub',
    '← 训练中心': '← Training hub',
    '中': '中',
    '呼吸': 'Breathe',
    '漂流': 'Drift',
    '远眺': 'Gaze',
    '声音': 'Sound',
    '吸': 'Inhale',
    '呼': 'Exhale',
    '看远处': 'Look far',
    '吸气时睁眼，呼气时出手。这一局不计分。': 'Open your eyes on the inhale, strike on the exhale. Nothing is scored.',
    '光点一直在漂。想打就打，想停就看。': 'The lights keep drifting. Strike when you like — or just watch.',
    '不用点。每二十秒，把视线放到最远的地方。': 'No clicking. Every twenty seconds, rest your eyes on the farthest point.',
    '花园 · GARDEN': 'Garden'
  };
  if (window.VernierShell && VernierShell.i18n) {
    try { VernierShell.i18n.register(I18N); } catch (e) {}
  }
  function L(zh, en) {
    var lang = (window.VernierShell && VernierShell.lang && VernierShell.lang.get()) || 'zh';
    return lang === 'en' ? en : zh;
  }

  /* ── 尺寸 ─────────────────────────────────────────────── */
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.round(window.innerWidth * DPR);
    H = Math.round(window.innerHeight * DPR);
    cv.width = W; cv.height = H;
    cv.style.width = window.innerWidth + 'px';
    cv.style.height = window.innerHeight + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    F = Math.min(W, H);
    HORIZON = H * 0.70;
    buildHills();
    if (PAL) buildSprites(); else readPalette();
    buildSprites();
    if (W) seedFlies();
    seedOrbs();
  }

  /* ── 光点 ─────────────────────────────────────────────── */
  function makeOrb(kind) {
    var s = Math.max(W, H);
    var o = {
      x: 0, y: 0, r: 0, born: performance.now(), life: 0,
      path: null, phase: Math.random() * Math.PI * 2, kind: kind || 'breathe'
    };
    if (kind === 'drift') {
      o.cx = W * (0.28 + Math.random() * 0.44);
      o.cy = H * (0.24 + Math.random() * 0.38);
      o.ax = W * (0.06 + Math.random() * 0.13);
      o.ay = H * (0.05 + Math.random() * 0.11);
      o.sx = (0.00010 + Math.random() * 0.00014);
      o.sy = (0.00012 + Math.random() * 0.00016);
      o.r = s * (0.020 + Math.random() * 0.016);
      o.life = Infinity;
    } else if (kind === 'gaze') {
      o.cx = W * (0.5 + (Math.random() - 0.5) * 0.5);
      o.cy = H * (0.30 + Math.random() * 0.22);
      o.ax = W * 0.02; o.ay = H * 0.02;
      o.sx = 0.00005; o.sy = 0.00005;
      o.r = s * (0.008 + Math.random() * 0.008);
      o.life = Infinity;
    } else {
      // 呼吸：出现在视野中部，尺寸随呼吸
      var ang = Math.random() * Math.PI * 2;
      var dist = Math.min(W, H) * (0.10 + Math.random() * 0.22);
      o.cx = W * 0.5 + Math.cos(ang) * dist;
      o.cy = H * 0.44 + Math.sin(ang) * dist * 0.72;
      o.ax = W * 0.012; o.ay = H * 0.012;
      o.sx = 0.0002; o.sy = 0.0002;
      o.r = s * (0.016 + Math.random() * 0.010);
      o.life = 6400;
    }
    return o;
  }

  function seedFlies() {
    flies = [];
    var n = reduce ? 10 : 26;
    for (var i = 0; i < n; i++) {
      flies.push({
        x: Math.random() * W,
        y: H * (0.30 + Math.random() * 0.62),
        vx: (Math.random() - 0.5) * 0.10,
        vy: -0.02 - Math.random() * 0.05,
        ph: Math.random() * Math.PI * 2,
        sp: 0.0004 + Math.random() * 0.0008,
        r: Math.max(0.9, DPR * (0.8 + Math.random() * 1.2))
      });
    }
  }

  function drawFlies(now, dt) {
    if (!flies.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < flies.length; i++) {
      var f = flies[i];
      if (!reduce) {
        f.x += f.vx * dt * 0.06 + Math.sin(now * 0.0004 + f.ph) * 0.10;
        f.y += f.vy * dt * 0.06 + Math.cos(now * 0.0003 + f.ph) * 0.08;
      }
      if (f.y < H * 0.16) { f.y = H * 0.92; f.x = Math.random() * W; }
      if (f.x < -20) f.x = W + 20; if (f.x > W + 20) f.x = -20;
      var a = 0.18 + 0.34 * (0.5 + 0.5 * Math.sin(now * f.sp + f.ph));
      ctx.globalAlpha = a;
      ctx.fillStyle = css(PAL.petal, 0.9);
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = a * 0.28;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 3.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function tooClose(o, minDist) {
    for (var i = 0; i < orbs.length; i++) {
      var d = Math.hypot(orbs[i].cx - o.cx, orbs[i].cy - o.cy);
      if (d < minDist) return true;
    }
    return false;
  }
  function spawnSpread(kind, count) {
    for (var i = 0; i < count; i++) {
      var o = null;
      for (var tries = 0; tries < 12; tries++) {
        o = makeOrb(kind);
        if (!tooClose(o, Math.min(W, H) * 0.20)) break;
      }
      if (o) orbs.push(o);
    }
  }
  function seedOrbs() {
    orbs = [];
    if (mode === 'drift') spawnSpread('drift', 4);
    else if (mode === 'gaze') spawnSpread('gaze', 3);
  }

  function updateOrbs(now, dt) {
    for (var i = orbs.length - 1; i >= 0; i--) {
      var o = orbs[i];
      var age = now - o.born;
      if (o.kind === 'breathe') {
        o.x = o.cx + Math.sin(age * o.sx * 6.28 + o.phase) * o.ax;
        o.y = o.cy + Math.cos(age * o.sy * 6.28 + o.phase) * o.ay;
        var k = age / o.life;
        o.alpha = k < 0.12 ? k / 0.12 : (k > 0.82 ? (1 - k) / 0.18 : 1);
        o.scale = 0.82 + 0.18 * breathPhase;
        if (age > o.life) { orbs.splice(i, 1); continue; }
      } else {
        o.x = o.cx + Math.sin(age * o.sx * 6.28 + o.phase) * o.ax;
        o.y = o.cy + Math.cos(age * o.sy * 6.28 + o.phase) * o.ay;
        o.alpha = 1; o.scale = 1;
        if (o.kind === 'gaze') o.scale = 0.7 + 0.3 * Math.sin(age * 0.0003 + o.phase);
      }
      if (o.px !== undefined) {
        var dx = o.x - o.px, dy = o.y - o.py;
        if (dx * dx + dy * dy > 0.04) {
          var want = Math.atan2(dy, dx);
          if (o.ang === undefined) o.ang = want;
          else {
            var diff = want - o.ang;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            o.ang += diff * 0.24;
          }
        }
      }
      o.px = o.x; o.py = o.y;
    }
  }

  function spawnBreatheOrb() {
    var o = makeOrb('breathe');
    orbs.push(o);
    if (orbs.length > 3) orbs.shift();
  }

  /* ── 粒子 / 涟漪 ──────────────────────────────────────── */
  function bloom(o) {
    var n = reduce ? 8 : 34;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      var sp = F * (0.00010 + Math.random() * 0.00034);
      petals.push({
        x: o.x, y: o.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - F * 0.00006,
        r: F * (0.0042 + Math.random() * 0.0058),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.005,
        life: 1700 + Math.random() * 1600, born: performance.now(),
        a: 0.30 + Math.random() * 0.28
      });
    }
    // 两圈扩散环 + 一次光爆
    rings.push({ x: o.x, y: o.y, r: o.r, born: performance.now(), life: 1100 });
    rings.push({ x: o.x, y: o.y, r: o.r * 1.6, born: performance.now(), life: 1600 });
    rings.push({ x: o.x, y: o.y, r: o.r * 0.4, born: performance.now(), life: 520, flash: true });
    chime(o.y / H);
  }

  function updateParticles(now) {
    for (var i = petals.length - 1; i >= 0; i--) {
      var p = petals[i], age = now - p.born;
      if (age > p.life) { petals.splice(i, 1); continue; }
      p.x += p.vx * 16; p.y += p.vy * 16;
      p.vy += F * 0.0000009 * 16;
      p.vx *= 0.996; p.vy *= 0.996;
      p.rot += p.vr * 16;
    }
    for (var j = rings.length - 1; j >= 0; j--) {
      if (now - rings[j].born > rings[j].life) rings.splice(j, 1);
    }
  }

  /* ── 声音（WebAudio 现场合成） ─────────────────────────── */
  var AU = { ctx: null, master: null, on: true, pad: null };
  var SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22];
  function initAudio() {
    if (AU.ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      AU.ctx = new AC();
      AU.master = AU.ctx.createGain();
      AU.master.gain.value = AU.on ? 0.10 : 0;
      AU.master.connect(AU.ctx.destination);
      var f = AU.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 900;
      f.connect(AU.master);
      var o1 = AU.ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 110;
      var o2 = AU.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 165.5;
      var g1 = AU.ctx.createGain(); g1.gain.value = 0.16;
      var g2 = AU.ctx.createGain(); g2.gain.value = 0.09;
      o1.connect(g1); o2.connect(g2); g1.connect(f); g2.connect(f);
      var lfo = AU.ctx.createOscillator(); lfo.frequency.value = 0.055;
      var lg = AU.ctx.createGain(); lg.gain.value = 0.05;
      lfo.connect(lg); lg.connect(g1.gain);
      o1.start(); o2.start(); lfo.start();
      AU.pad = { o1: o1, o2: o2, g1: g1, g2: g2 };
      if (AU.ctx.state === 'suspended') AU.ctx.resume();
    } catch (e) {}
  }
  function chime(posY) {
    if (!AU.ctx || !AU.on) return;
    var t = AU.ctx.currentTime;
    var semis = SCALE[Math.floor(Math.random() * SCALE.length)];
    var base = 220 * Math.pow(2, (12 + semis + (1 - posY) * 5) / 12);
    for (var i = 0; i < 3; i++) {
      var o = AU.ctx.createOscillator();
      var g = AU.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = base * (i + 1) * (i ? 1.003 : 1);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22 / (i + 1.4), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15 + i * 0.12);
      o.connect(g); g.connect(AU.master);
      o.start(t); o.stop(t + 1.4 + i * 0.12);
    }
  }
  function breathSound(inhale) {
    if (!AU.ctx || !AU.on) return;
    var t = AU.ctx.currentTime;
    var dur = 2.4;
    var buf = AU.ctx.createBuffer(1, Math.ceil(AU.ctx.sampleRate * dur), AU.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    var src = AU.ctx.createBufferSource(); src.buffer = buf;
    var f = AU.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = inhale ? 620 : 420; f.Q.value = 0.9;
    var g = AU.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.5);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(f); f.connect(g); g.connect(AU.master);
    src.start(t); src.stop(t + dur);
  }

  /* ── 绘制 ─────────────────────────────────────────────── */
  function drawSky(now) {
    var g = ctx.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, css(PAL.skyTop, 1));
    g.addColorStop(0.42, css(PAL.skyMid, 1));
    g.addColorStop(0.78, css(PAL.skyHaze, 1));
    g.addColorStop(1, css(PAL.skyLow, 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, HORIZON + 2);
    // 星云光斑：两团极大极淡的彩色雾
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var nb = 0; nb < 2; nb++) {
      var nx = W * (nb ? 0.72 : 0.28) + Math.sin(now * 0.00002 + nb * 2.4) * W * 0.05;
      var ny = H * (nb ? 0.20 : 0.30) + Math.cos(now * 0.000017 + nb) * H * 0.03;
      var nr = Math.max(W, H) * (nb ? 0.42 : 0.34);
      var ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      ng.addColorStop(0, css(PAL.aurora[nb + 1] || PAL.aurora[0], 0.075));
      ng.addColorStop(0.5, css(PAL.aurora[nb ? 0 : 2], 0.032));
      ng.addColorStop(1, css(PAL.aurora[0], 0));
      ctx.fillStyle = ng;
      ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // 极光带
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 3; i++) {
      var ph = now * (0.000035 + i * 0.000012) + i * 2.1;
      var yc = H * (0.16 + i * 0.10);
      var amp = H * (0.022 + i * 0.010);
      ctx.beginPath();
      ctx.moveTo(-20, yc);
      for (var x = -20; x <= W + 20; x += 24) {
        var t = x / W * Math.PI * 2;
        ctx.lineTo(x, yc + Math.sin(t * (1.3 + i * 0.5) + ph) * amp + Math.sin(t * 3.1 - ph * 0.7) * amp * 0.35);
      }
      for (var x2 = W + 20; x2 >= -20; x2 -= 24) {
        var t2 = x2 / W * Math.PI * 2;
        ctx.lineTo(x2, yc + H * (0.10 + i * 0.04) + Math.sin(t2 * (1.1 + i * 0.4) - ph) * amp * 1.4);
      }
      ctx.closePath();
      var gr = ctx.createLinearGradient(0, yc - amp, 0, yc + H * 0.16);
      gr.addColorStop(0, css(PAL.aurora[i], 0.055));
      gr.addColorStop(0.45, css(PAL.aurora[i], 0.028));
      gr.addColorStop(1, css(PAL.aurora[i], 0));
      ctx.fillStyle = gr; ctx.fill();
    }
    ctx.restore();
  }

  function drawStars(now) {
    if (!starCv || !PAL.dark) return;
    var px = (P.x - W / 2) * 0.006, py = (P.y - H / 2) * 0.004;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(now * 0.00035);
    ctx.drawImage(starCv, px, py, W, H);
    ctx.globalAlpha = 0.28;
    ctx.drawImage(starCv, px * 1.6 + 2, py * 1.6 - 2, W, H);
    ctx.restore();
  }

  function drawHills(now) {
    for (var i = 0; i < hills.length; i++) {
      var L = hills[i];
      var yBase = H * L.y;
      var amp = H * L.amp;
      var sx = (P.x - W / 2) * (0.008 + i * 0.006);
      ctx.beginPath();
      ctx.moveTo(-10, H);
      for (var x = -10; x <= W + 10; x += 18) {
        var t = x / W * Math.PI * 2 * L.wl;
        var y = yBase - (Math.sin(t + L.ph + now * 0.00002) * 0.6 + Math.sin(t * 2.3 + L.ph * 1.7) * 0.4) * amp;
        ctx.lineTo(x - sx, y);
      }
      ctx.lineTo(W + 10, H);
      ctx.closePath();
      ctx.fillStyle = css(PAL[L.col], 1);
      ctx.fill();
    }
  }

  function drawLake(now) {
    var g = ctx.createLinearGradient(0, HORIZON, 0, H);
    g.addColorStop(0, css(mix(PAL.lake, PAL.skyHaze, 0.30), 1));
    g.addColorStop(0.16, css(mix(PAL.lake, [0, 0, 0], 0.16), 1));
    g.addColorStop(0.55, css(mix(PAL.lake, [0, 0, 0], 0.34), 1));
    g.addColorStop(1, css(mix(PAL.lake, [0, 0, 0], PAL.dark ? 0.58 : 0.30), 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, HORIZON, W, H - HORIZON);

    // 山影倒影：把同样的山形绕地平线镜像，压暗、低 alpha、微微横向抖动
    ctx.save();
    for (var hi = hills.length - 1; hi >= 0; hi--) {
      var HL = hills[hi];
      var yb = H * HL.y, ampL = H * HL.amp;
      var sxc = (P.x - W / 2) * (0.008 + hi * 0.006);
      ctx.beginPath();
      ctx.moveTo(-10, HORIZON);
      for (var xx = -10; xx <= W + 10; xx += 18) {
        var tt = xx / W * Math.PI * 2 * HL.wl;
        var yy = yb - (Math.sin(tt + HL.ph + now * 0.00002) * 0.6 + Math.sin(tt * 2.3 + HL.ph * 1.7) * 0.4) * ampL;
        // 镜像 + 向水面压缩 0.55，制造透视
        ctx.lineTo(xx - sxc, HORIZON + (HORIZON - yy) * 0.55);
      }
      ctx.lineTo(W + 10, HORIZON);
      ctx.closePath();
      ctx.fillStyle = css(mix(PAL[HL.col], [0, 0, 0], 0.35), 0.28 - hi * 0.05);
      ctx.fill();
    }
    ctx.restore();

    // 地平线薄雾
    var mg = ctx.createLinearGradient(0, HORIZON - H * 0.05, 0, HORIZON + H * 0.06);
    mg.addColorStop(0, css(PAL.skyHaze, 0));
    mg.addColorStop(0.45, css(PAL.skyHaze, 0.16));
    mg.addColorStop(1, css(PAL.skyHaze, 0));
    ctx.fillStyle = mg;
    ctx.fillRect(0, HORIZON - H * 0.05, W, H * 0.11);

    // 水面碎光
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 14; i++) {
      var yy = HORIZON + (i + 1) * ((H - HORIZON) / 15);
      var a = 0.030 + 0.018 * Math.sin(now * 0.0006 + i);
      ctx.strokeStyle = css(PAL.aurora[i % 3], a);
      ctx.lineWidth = Math.max(1, DPR * 0.8);
      ctx.beginPath();
      var off = Math.sin(now * 0.0004 + i * 1.7) * W * 0.02 + (P.x - W / 2) * 0.01;
      ctx.moveTo(W * 0.35 + off, yy);
      ctx.lineTo(W * 0.65 + off, yy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* 目标形象：萤火虫。
     身体 + 两片会拍的翅膀 + 尾灯 —— 用「有形象的虫」承载「无形的光」。
     光晕只做陪衬（≤18%），不刺眼；靠近时翅尖会快一点，表示它注意到你了。 */
  function drawOrbs(now) {
    if (!orbCv) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < orbs.length; i++) {
      var o = orbs[i];
      var a = (o.alpha === undefined ? 1 : o.alpha) * 0.86;
      var r = o.r * (o.scale || 1);
      var near = P.seen ? Math.max(0, 1 - Math.hypot(o.x - P.x, o.y - P.y) / (r * 7)) : 0;
      // 明灭（真实萤火虫是慢慢亮、慢慢暗）
      var blink = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(now * 0.0010 + o.phase), 2);
      a *= 0.55 + 0.45 * blink;
      // 极淡光晕（只是氛围，不是本体）
      ctx.globalAlpha = a * 0.09;
      ctx.drawImage(haloCv, o.x - r * 4.6, o.y - r * 4.6, r * 9.2, r * 9.2);
      // 本体改用正常混合：让萤火虫是一只「实体的虫」，而不是一团光
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.ang || 0);
      var L1 = r * 0.62, L2 = r * 0.30;   // 本体：长 1.24r，宽 0.6r
      // 翅膀：细长、掠向后，半透明会拍
      var flapFreq = 0.011 + near * 0.012;
      var flap = 0.22 + 0.78 * Math.abs(Math.sin(now * flapFreq + o.phase * 1.7));
      ctx.globalAlpha = a * 0.34;
      ctx.fillStyle = 'rgba(232,244,242,1)';
      for (var w = -1; w <= 1; w += 2) {
        ctx.beginPath();
        ctx.ellipse(-L1 * 0.36, w * L2 * (0.82 + 0.20 * flap), L1 * 0.98, L2 * 0.42 * flap, w * 0.94, 0, Math.PI * 2);
        ctx.fill();
      }
      // 身体：暖琥珀色的梭形（实心、有轮廓）
      ctx.globalAlpha = Math.min(1, a * 0.92);
      ctx.fillStyle = 'rgb(228,178,104)';
      ctx.beginPath();
      ctx.moveTo(L1, 0);
      ctx.quadraticCurveTo(L1 * 0.2, -L2 * 0.95, -L1 * 0.92, -L2 * 0.22);
      ctx.quadraticCurveTo(-L1 * 1.02, 0, -L1 * 0.92, L2 * 0.22);
      ctx.quadraticCurveTo(L1 * 0.2, L2 * 0.95, L1, 0);
      ctx.closePath(); ctx.fill();
      // 头灯：亮的一端放在**前面**——人眼会把亮点认作头，放后面就会「倒着飞」
      ctx.globalAlpha = Math.min(1, a * 0.95);
      ctx.fillStyle = 'rgb(255,240,200)';
      ctx.beginPath(); ctx.arc(L1 * 0.62, 0, L2 * 0.36, 0, Math.PI * 2); ctx.fill();
      // 尾端：暗琥珀，收住
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = 'rgb(120,86,44)';
      ctx.beginPath(); ctx.arc(-L1 * 0.88, 0, L2 * 0.20, 0, Math.PI * 2); ctx.fill();
      // 触角：从头部往前伸
      ctx.globalAlpha = a * 0.34;
      ctx.strokeStyle = 'rgb(168,136,92)';
      ctx.lineWidth = Math.max(0.6, DPR * 0.55);
      ctx.beginPath();
      ctx.moveTo(L1 * 0.70, 0); ctx.quadraticCurveTo(L1 * 1.25, -L2 * 0.55, L1 * 1.55, -L2 * 1.05);
      ctx.moveTo(L1 * 0.70, 0); ctx.quadraticCurveTo(L1 * 1.25, L2 * 0.55, L1 * 1.55, L2 * 1.05);
      ctx.stroke();
      ctx.restore();
      // 水面倒影：只留一点摇曳的光
      if (o.y < HORIZON) {
        ctx.globalAlpha = a * 0.10;
        ctx.drawImage(haloCv, o.x - r * 2.0, HORIZON + 6, r * 4.0, r * 7);
      }
    }
    ctx.restore();
  }

  function drawPetals(now) {
    if (!petals.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < petals.length; i++) {
      var p = petals[i];
      var k = 1 - Math.max(0, Math.min(1, (now - p.born) / p.life));
      if (k <= 0) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.a * k * 1.1);
      var s = p.r * 6.4;
      ctx.drawImage(petalCv, -s * 0.5, -s * 0.5 * 0.52, s, s * 0.52);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawRings(now) {
    for (var i = 0; i < rings.length; i++) {
      var r = rings[i];
      var k = Math.max(0, Math.min(1, (now - r.born) / r.life));
      if (k >= 1) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (r.flash) {
        var fr = Math.max(1, r.r + k * F * 0.09);
        var fg = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, fr);
        fg.addColorStop(0, css(PAL.orbCore, (1 - k) * 0.16));
        fg.addColorStop(0.55, css(PAL.orb, (1 - k) * 0.10));
        fg.addColorStop(1, css(PAL.orb, 0));
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(r.x, r.y, fr, 0, Math.PI * 2); ctx.fill();
      } else {
        var rad = Math.max(1, r.r + k * F * 0.22);
        ctx.strokeStyle = css(PAL.orb, (1 - k) * 0.20);
        ctx.lineWidth = Math.max(1, DPR * (1.8 - k * 1.2));
        ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* 呼吸引导：不是硬边圆，是水面涟漪。
     吸气时涟漪向外散，呼气时向内收 —— 用有形象的水纹表达呼吸。 */
  function drawBreathRing(now) {
    if (mode !== 'breathe') return;
    var cx = W * 0.5, cy = H * 0.44;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 3; i++) {
      var t = ((now * 0.00013 + i / 3) % 1);
      var rad = F * (0.05 + t * 0.30) * (0.82 + 0.18 * breathPhase);
      var al = (1 - t) * (0.035 + 0.055 * breathPhase);
      if (al <= 0.002) continue;
      ctx.strokeStyle = css(PAL.orbHalo, al);
      ctx.lineWidth = Math.max(1, DPR * (1.4 - t * 0.8));
      // 略微不规则：手画的水纹不是正圆
      ctx.beginPath();
      for (var k = 0; k <= 64; k++) {
        var ang = k / 64 * Math.PI * 2;
        var rr = rad * (1 + 0.018 * Math.sin(ang * 3 + now * 0.0004 + i));
        var px2 = cx + Math.cos(ang) * rr, py2 = cy + Math.sin(ang) * rr * 0.82;
        if (k === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawCross(now) {
    if (!P.seen) return;
    var r = F * 0.012;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = css(PAL.star, 0.5);
    ctx.lineWidth = Math.max(1, DPR * 0.9);
    ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = css(PAL.star, 0.8);
    ctx.beginPath(); ctx.arc(P.x, P.y, Math.max(1.1, DPR * 1.2), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawVignette() {
    if (!vigCv) return;
    ctx.drawImage(vigCv, 0, 0, W, H);
  }

  /* ── 主循环 ───────────────────────────────────────────── */
  var breathNextCue = 0;
  function frame(now) {
    var dt = Math.min(64, now - last);
    last = now;

    // 呼吸相位：6s 一个周期（吸 3s，呼 3s）
    var cyc = ((now - t0) % 6000) / 6000;
    breathPhase = cyc < 0.5 ? (cyc / 0.5) : (1 - (cyc - 0.5) / 0.5);

    // 指针缓动
    P.x += (P.tx - P.x) * 0.18;
    P.y += (P.ty - P.y) * 0.18;

    // 模式逻辑
    if (mode === 'breathe') {
      if (cyc < 0.02 && now > nextSpawn) {
        nextSpawn = now + 400;
        spawnBreatheOrb();
        if (!reduce && now > breathNextCue) { breathNextCue = now + 3000; breathSound(true); }
      }
    } else if (mode === 'drift') {
      if (orbs.length < 4) { var no = makeOrb('drift'); if (!tooClose(no, Math.min(W, H) * 0.20)) orbs.push(no); }
    } else if (mode === 'gaze') {
      gazeTimer += dt;
      if (gazeTimer > 20000) { gazeTimer = 0; cue(L('看远处', 'Look far'), 3200); }
    }

    updateOrbs(now, dt);
    updateParticles(now);

    // 绘制
    drawSky(now);
    drawStars(now);
    drawHills(now);
    drawLake(now);
    drawFlies(now, dt);
    drawBreathRing(now);
    drawOrbs(now);
    drawPetals(now);
    drawRings(now);
    drawCross(now);
    drawVignette();

    updateHUD(now);
    requestAnimationFrame(frame);
  }

  /* ── HUD（极简：只在呼吸模式显示「吸/呼」） ─────────────── */
  var breathEl = document.getElementById('breathLabel');
  var shownLabel = '';
  function updateHUD(now) {
    if (!breathEl) return;
    var want = '';
    if (mode === 'breathe') {
      var cyc = ((now - t0) % 6000) / 6000;
      want = cyc < 0.5 ? L('吸', 'Inhale') : L('呼', 'Exhale');
    }
    if (want !== shownLabel) {
      shownLabel = want;
      breathEl.textContent = want;
      breathEl.classList.toggle('is-on', !!want);
    }
    if (mode !== 'breathe') breathEl.classList.remove('is-on');
  }

  var cueTimer = null;
  function cue(text, ms) {
    var el = document.getElementById('gardenHint');
    if (!el || !text) return;
    el.textContent = text;
    if (cueTimer) clearTimeout(cueTimer);
    cueTimer = setTimeout(function () {
      var m = MODES[mode];
      el.textContent = L(m.hintZh, m.hintEn);
    }, ms || 2600);
  }

  /* ── 模式切换 ─────────────────────────────────────────── */
  function setMode(m) {
    if (!MODES[m]) return;
    mode = m;
    orbs = []; petals = []; rings = [];
    gazeTimer = 0;
    t0 = performance.now();
    if (m === 'breathe') { spawnBreatheOrb(); }
    else seedOrbs();
    var btns = document.querySelectorAll('.garden-modes button');
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-selected', btns[i].dataset.mode === m ? 'true' : 'false');
    var d = MODES[m];
    var tEl = document.getElementById('gardenTitle');
    var hEl = document.getElementById('gardenHint');
    if (tEl) tEl.textContent = L(d.zh, d.en);
    if (hEl) hEl.textContent = L(d.hintZh, d.hintEn);
    try { history.replaceState(null, '', '#' + m); } catch (e) {}
    if (AU.ctx) { try { if (AU.ctx.state === 'suspended') AU.ctx.resume(); } catch (e) {} }
  }

  /* ── 交互 ─────────────────────────────────────────────── */
  function toLocal(ev) {
    var r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * DPR, y: (ev.clientY - r.top) * DPR };
  }
  cv.addEventListener('pointermove', function (ev) {
    var p = toLocal(ev);
    P.tx = p.x; P.ty = p.y;
    if (!P.seen) { P.x = p.x; P.y = p.y; P.seen = true; }
  });
  cv.addEventListener('pointerdown', function (ev) {
    initAudio();
    var p = toLocal(ev);
    P.tx = p.x; P.ty = p.y;
    if (!P.seen) { P.x = p.x; P.y = p.y; P.seen = true; }
    // 找最近的光点
    var best = null, bestD = 1e9;
    for (var i = 0; i < orbs.length; i++) {
      var o = orbs[i];
      var d = Math.hypot(o.x - p.x, o.y - p.y);
      var hitR = o.r * 3.0 + F * 0.02;
      if (d < hitR && d < bestD) { best = o; bestD = d; }
    }
    if (best) {
      bloom(best);
      var idx = orbs.indexOf(best);
      if (idx >= 0) orbs.splice(idx, 1);
      if (mode === 'drift') orbs.push(makeOrb('drift'));
      if (mode === 'gaze') orbs.push(makeOrb('gaze'));
      if (mode === 'breathe' && !orbs.length) spawnBreatheOrb();
    } else {
      rings.push({ x: p.x, y: p.y, r: F * 0.004, born: performance.now(), life: 620 });
    }
  }, { passive: true });

  // 模式按钮：两重绑定（直接 click + document 委托），避免任何覆盖层/事件拦截导致点不动
  function onModePick(btn) {
    if (!btn) return;
    initAudio();
    setMode(btn.getAttribute('data-mode'));
  }
  var modeBtns = document.querySelectorAll('.garden-modes button');
  for (var mb = 0; mb < modeBtns.length; mb++) {
    (function (btn) {
      btn.addEventListener('click', function (ev) { ev.preventDefault(); onModePick(btn); });
    })(modeBtns[mb]);
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('.garden-modes button') : null;
    if (t) { ev.preventDefault(); onModePick(t); }
  }, true);
  document.addEventListener('pointerup', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('.garden-modes button') : null;
    if (t && !t.__picked) { t.__picked = 1; setTimeout(function () { t.__picked = 0; }, 300); onModePick(t); }
  }, true);

  addEventListener('keydown', function (ev) {
    var k = ev.key;
    if (k === '1') setMode('breathe');
    else if (k === '2') setMode('drift');
    else if (k === '3') setMode('gaze');
    else if (k === 'm' || k === 'M') toggleSound();
  });

  /* ── 声音开关 ─────────────────────────────────────────── */
  var soundBtn = document.getElementById('soundBtn');
  function toggleSound() {
    AU.on = !AU.on;
    if (AU.master) { try { AU.master.gain.value = AU.on ? 0.10 : 0; } catch (e) {} }
    if (soundBtn) soundBtn.setAttribute('aria-pressed', AU.on ? 'true' : 'false');
  }
  if (soundBtn) soundBtn.addEventListener('click', function () { initAudio(); toggleSound(); });

  /* ── 启动 ─────────────────────────────────────────────── */
  addEventListener('resize', function () {
    clearTimeout(resize._t);
    resize._t = setTimeout(resize, 160);
  });
  // 主题变化（设置页改主题后回到这里）时重取色板
  setInterval(function () {
    var cur = document.documentElement.getAttribute('data-theme');
    if (cur !== PAL._theme) { PAL._theme = cur; readPalette(); }
  }, 900);

  resize();
  PAL._theme = document.documentElement.getAttribute('data-theme');
  var hash = (location.hash || '').replace('#', '');
  setMode(MODES[hash] ? hash : 'breathe');
  requestAnimationFrame(frame);

  // 供 QA / 调试
  window.__garden = {
    mode: function () { return mode; },
    orbs: function () { return orbs.length; },
    petals: function () { return petals.length; },
    orbsPos: function () { return orbs.map(function (o) { return { x: o.x / DPR, y: o.y / DPR, r: o.r / DPR }; }); },
    orbsAng: function () { return orbs.map(function (o) { return o.ang || 0; }); },
    setMode: setMode,
    audio: function () { return { ready: !!AU.ctx, on: AU.on }; }
  };
})();
