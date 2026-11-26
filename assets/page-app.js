/* ============================================================================
   page-app.js — app.html 专属逻辑（W2）
   ----------------------------------------------------------------------------
   来源：app.html 两段内联 <script>（2100 行主脚本 + 手机提示条）原样迁出。
   主题初始化 / --on-acc / 语言状态与切换 / 涟漪 / 剪贴板兜底 → 已由 assets/shell.js 接管（W2）。
   本文件保留 app 专属：词典与 TX_RULES 翻译器（注册给 shell）、主题设置 UI、4 tab 路由与各 tab 渲染。
   app 专属：4 tab 路由、训练目录、数据与图表、设置/准星/场景、日历与多套计划、分享码。
   ========================================================================== */

const K_CFG='cs2at.cfg', K_BEST='cs2at.best', K_RUNS='cs2at.runs', K_PERF='cs2at.perf',
      K_FPS='cs2at.fps', K_FPSSHOW='cs2at.fpsShow', K_THEME='cs2at.theme', K_SCENE='cs2at.scene';
const $=id=>document.getElementById(id);
const load=(k,d)=>{ try{ const v=localStorage.getItem(k); return v? JSON.parse(v): d; }catch(e){ return d; } };
const save=(k,v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const MODE_NAME={random:'自适应随机', block:'定角重复', axis:'分轴定位', precision:'小球精度', wide:'大角度甩枪', track:'微调训练', check:'六维检查'};

/* 主题色块不存 hex：渲染时用 data-theme 子作用域直接读 theme.css 的 --acc/--bg */
const THEMES=[
  {id:'jade',  name:'墨玉', kind:'rec'},
  {id:'ink',   name:'墨鱼', kind:'rec'},
  {id:'lake',  name:'湖泊', kind:'light'},
  {id:'light', name:'明亮', kind:'light'},
  {id:'sand',  name:'暖砂', kind:'light'},
  {id:'forest',name:'森林', kind:'dark'},
  {id:'mono',  name:'极简灰', kind:'dark'},
  {id:'cyber', name:'赛博', kind:'dark'},
  {id:'night', name:'深蓝', kind:'dark'}
];
/* 场景色板：id/顺序/颜色全部来自 assets/scenes.js 的 GAME_SCENES（唯一来源），
   这里只补中文名。之前手抄的 7 项色表漏了 lake（湖泊）场景，与 THEME2SCENE 不一致。 */
const SCENE_NAMES={classic:'经典', lake:'湖泊', jade:'墨玉', ink:'墨鱼', light:'浅灰', night:'暗蓝', mono:'纯黑', cs:'沙色'};
const SCENES=Object.keys(window.GAME_SCENES||{}).map(function(id){
  return {id:id, name:SCENE_NAMES[id]||id, dot:(window.GAME_SCENES[id]||{}).tgt||''};
});


/* ---------- i18n ---------- */
const K_LANG='cs2at.lang';
const EN={
  '个人数据':'Stats','训练':'Drills','计划训练':'Plan','设置':'Settings','← 首页':'← Home','瞄准，度量':'aim, measured',
  '最佳成绩按模式分别记录，只存在本浏览器。':'Best results per mode, stored locally in this browser.',
  '总训练组数':'Sets','训练天数':'Days','本地组数':'Local sets','最低限时':'Best limit','最高命中率':'Best hit rate',
  '历史最低限时':'Historical best limit','历史最高命中率':'Historical best hit rate',
  '各模式最佳（历史）':'Best per mode (historical)','重算最佳':'Rebuild best',
  '难度':'Difficulty','最佳难度':'Best difficulty',
  '各模式最佳':'Best per mode','最近记录':'Recent runs','趋势（最近 60 组）':'Trend (last 60 runs)','六维走势':'Six-dim trend',
  '重新开始（清空计划进度）':'Start over (clear plan progress)',
  '现在怎么样':'How am I doing','最佳命中':'Best hit','最佳用时':'Best time','数据管理':'Data management',
  '导出、导入或清空全部训练数据。':'Export, import or clear all training data.',
  '备份或恢复全部本地数据（成绩、计划、设置、准星）。':'Back up or restore all local data (scores, plan, settings, crosshair).',
  '清空训练数据':'Clear training data','删除':'Delete',
  '文件格式不对，没有改动任何数据。':'Invalid file — nothing was changed.',
  '全部 ▾':'All ▾','收起 ▴':'Collapse ▴',
  '模式':'Mode','最低限时':'Best limit','最高命中率':'Best hit','最快中位用时':'Fastest median','组数':'Sets',
  '自适应随机':'Adaptive','定角重复':'Fixed angle','分轴定位':'Axis-staged','小球精度':'Precision','跟枪测试':'Tracking',
  "90 秒跟枪，输出跟踪误差 RMS、相位滞后、速度增益——检验跟枪手感。":"90-second tracking: error RMS, phase lag and speed gain — test your tracking feel.",
  '六维检查':'Check-up','90 秒一局测六样：反应、第一枪、反应确定、微调、拉枪、稳定。打完告诉你怎么练。':'One 90-second run scores six skills — reaction, first shot, confirm, micro-adjust, flick, steadiness — then tells you what to train.',
  '状态快测':'State check','20 球无时限，球大小按命中率自适应，快速看今天手感。':'20 dots, no time limit — size adapts to your hit rate. A quick feel check for today.',
  '大角度甩枪':'Wide flick','微调训练':'Micro-adjust',
  '80-160° 回头枪，练转身定位，CS 最常用的场景。':'80–160° turn shots — the most common CS scenario.',
  '目标匀速漂移，跟着点。VAL / APEX / OW 的核心项目。':'Targets drift at a steady speed — click while tracking. Core skill for VAL / APEX / OW.',
  '球固定 1.5°，只调限时，按 85% 成功率走。主练用这个。':'Fixed 1.5° dots — only the time limit adjusts toward 85% success. For main practice.',
  '同一轴左右交替 8 球，形成运动程序，热身用。':'8 dots alternating left/right on one axis to build a motor program. For warm-up.',
  "红色竖线标出目标的水平位置，准星横向进带即刻变绿，提示你已横移到位；随后只剩垂直微调，再点击。练的是把二维瞄准拆成两段一维动作。":"A red vertical line marks the horizontal position of the target; the crosshair turns green the moment you slide into the band — horizontal done. Then only the vertical nudge is left, then click. Two one-dimensional actions instead of one two-dimensional aim.",
  '0.7° 小球，无时限，练一次定位的精度。':'0.7° dots, no limit. For one-shot precision.',
  '评估':'Assessment','练习':'Practice',
  '日期':'Date','限时':'Limit','命中率':'Hit rate','中位用时':'Median',
  '导出 JSON':'Export JSON','导入':'Import','清空全部数据':'Clear all data',
  '还没有数据，去练一组吧':'No data yet — run a set','暂无记录':'No runs yet',
  '不知道自己该用多少灵敏度？':'Not sure what sensitivity to use?','去标定一次':'Calibrate','，把明显的过头/不足修掉。':', it fixes obvious over/undershoot.',
  '这周还没练。':'Nothing this week yet.','去练一组 →':'Start a set →','先去标定':'Calibrate first',
  '四周计划，自动判断今天该练什么。':'Four-week plan; it knows what to do today.',
  '这里的参数会自动带进所有训练页面。':'These values are passed to every trainer page.',
  '灵敏度':'Sensitivity','鼠标 DPI':'Mouse DPI','CS 灵敏度':'CS sensitivity',
  '换鼠标、改 DPI 或手感发飘，先回来重新标定一次。':'New mouse, DPI change, or drifting feel — come back and recalibrate first.',
  '游戏':'Game',
  '灵敏度 · CS2 / CS:GO':'Sensitivity · CS2 / CS:GO',
  '先选游戏，再改下面的灵敏度；改完自动换算，DPI 不动。只按腰射，开镜倍率不适用。m_yaw 没改过就别动（默认 0.022 就是对的）。':'Pick the game first, then set its sensitivity below; it converts automatically, DPI untouched. Hipfire only — ADS multipliers are not covered. Leave m_yaw alone unless you changed it in-game (0.022 is the default).',
  '游戏灵敏度得是正数':'Enter a positive sensitivity',
  '灵敏度标定':'Calibrator',
  '测出你每次都甩过头还是不够，把明显的偏差修掉。':'Measures whether you overshoot or fall short, and fixes the obvious bias.',
  '快速标定':'Quick calibration','固定 3 轮出建议，新手快速找到自己的灵敏度。':'3 fixed rounds then a suggestion — the fast way for beginners to find their sensitivity.',
  '遇到瓶颈的用户：找出属于这个阶段最好的灵敏度。':'Hit a plateau? Find the best sensitivity for your current stage.',
  '阶梯精度':'Staircase','随机距离':'Distance',
  '初段覆盖':'First-move coverage','看你第一段甩动覆盖了目标多远——动作习惯，不是灵敏度。':'How far your first movement covers toward the target — a habit, not your sensitivity.',
  '开环标定':'Open-loop calibration','拟合甩出前 250ms 的弹道——测「预设落点」，灵敏度本身。':'Fits your first 250 ms of flick — measures the preset endpoint, sensitivity itself.',
  '语言 / Language':'Language',
  '输入设备':'Input device',
  '选训练时的输入设备；手柄瞄准方式在这里调。':'Pick the training input device; gamepad aim style is tuned here.',
  '设备':'Device','鼠标':'Mouse','手柄':'Gamepad','绘画板 / 绘画笔':'Drawing tablet / pen',
  '手柄瞄准':'Gamepad aim','速度式':'Velocity','绝对式':'Absolute','原始输入':'Raw input',
  '训练画面':'Training view',
  '只影响训练器里的视角，不改变网页界面。':'Affects only the in-training view, not the site UI.',
  '开始倒计时（秒）':'Start countdown (s)',
  '训练分辨率':'Training resolution',
  '自定义':'Custom',
  '界面主题':'UI theme',
  '墨玉':'Jade','墨鱼':'Ink','湖泊':'Lake','明亮':'Light','暖砂':'Sand','森林':'Forest','极简灰':'Mono','赛博':'Cyber','深蓝':'Night',
  '经典':'Classic','浅灰':'Light grey','暗蓝':'Night blue','纯黑':'Mono black','沙色':'Sand',
  '训练场景':'Training scene','背景、网格、准星的颜色。':'Background, grid and crosshair colours in the trainer.','只影响网页界面，不影响训练场景。':'Affects the UI only, not the training scene.',
  '最近':'Last','六维':'Six-skill','本周':'This week','天':'days','未设置':'not set','未测':'not run yet','存图':'Save image',
  '球':'balls','第':'No.','天 · 已完成':' days · done','天 · 连续':' days · streak',
  '一':'M','二':'T','三':'W','四':'T','五':'F','六':'S','日':'S',
  '01 — 训练 · DRILLS':'01 — Training · Drills',
  '训练 · DRILLS':'TRAINING',
  '数据 · DATA':'DATA','计划 · PLAN':'PLAN','设置 · SETTINGS':'SETTINGS',
  '最近六维':'Last six-skill','本周训练':'This week','辅助等级':'Axis level','先从六维检查开始':'Start with the six-skill check',
  '定位':'Positioning','速度':'Speed','转向':'Turning','稳定':'Stability','体检':'Assessment',
  '今天练什么':'Today\u2019s drill','先从六维检查开始 →':'Start with the six-skill check →',
  '自动（跟随时间）':'Auto (by time)','明亮':'Light','深色':'Dark',
  '当前按本地时间自动切换（06:30–18:30 明亮）':'Following local time — light from 06:30 to 18:30',
  '作者推荐':'Author picks','— 大肥鱼常用的两套，日用与夜用':'— two themes the author actually uses, day and night',
  '浅色':'Light','深色':'Dark',

  // 计划页
  '今日训练':'Today','每一项都能改、删掉或再加一项；计划名双击可直接改。':'Every row is editable — delete or add rows; double-click a plan name to rename.',
  '改名':'Rename','删除这套计划':'Delete this plan','＋ 新建':'＋ New','＋ 添加一项':'＋ Add a row',
  '热身':'Warm-up','主练':'Main','精度':'Accuracy','新项目':'New item',
  '标准':'Standard','精简':'Lite','加量':'Heavy','双击改名':'Double-click to rename',
  '进度':'Progress','绿色 = 已完成 · 描边 = 今天 · 淡色 = 休息日':'Green = done · outlined = today · faded = rest day',
  '高亮 = 已完成 · 描边 = 今天 · 淡色 = 周末休息':'Highlighted = done · outlined = today · faded = weekend rest',
  '开始':'Start','模式':'Mode',
  '标记今天完成':'Mark today done','重新开始（清空记录）':'Start over (clear log)',
  '训练记录':'Training log','保存这条':'Save entry','复制全部':'Copy all',
  '第 1 天':'Day 1',
  // 主题名
  '墨玉':'Jade','墨鱼':'Ink','湖泊':'Lake','明亮':'Bright','暖砂':'Warm sand',
  '森林':'Forest','极简灰':'Graphite','赛博':'Cyber','深蓝':'Deep blue',
  // 场景名
  '经典':'Classic','浅灰':'Pale grey','暗蓝':'Night blue','纯黑':'Pure black','沙色':'Sandstone',
  '训练场景配色':'Training scene palette','训练页 3D 场景的背景、网格与准星配色。':'Background, grid and crosshair colours in the trainer.',

  '准星':'Crosshair',
  '样式、尺寸、颜色都可调；分享码只包含准星。':'Style, size and colour are all adjustable; the share code covers the crosshair only.',
  '样式':'Style','十字':'Cross','圆点':'Dot','静态':'Static','动态':'Dynamic',
  '颜色来源':'Colour source','跟随场景':'Follow scene','主色':'Main','描边':'Outline',
  '长度':'Length','粗细':'Thickness','间隙':'Gap','中心点':'Center dot','边框':'Outline',
  '命中特效':'Hit effect','闪光':'Flash','碎裂':'Shatter','组合':'Combo','关':'Off',
  '透明度':'Opacity',
  '准星击中反馈':'Crosshair hit flash','自动（背景对比色）':'Auto (contrast to background)','颜色':'Colour',
  '大小':'Size','小':'Small','大':'Large',
  '分享准星':'Share crosshair','导入准星':'Import crosshair','准星分享码：':'Crosshair share code: ','粘贴准星分享码':'Paste crosshair share code',
  '格式不对':'Invalid code','已导入准星':'Crosshair imported',
  '渲染帧率上限':'Frame-rate cap','显示实时帧率':'Show live FPS',
  '性能模式（减少网格密度）':'Performance mode (lower grid density)',
  '恢复默认':'Reset defaults',
  '无限制（跟随刷新率）':'Unlimited (follow refresh)',
  '60 帧':'60 fps','120 帧':'120 fps','144 帧':'144 fps','240 帧':'240 fps',
  '2026-10-24  限时450ms  命中率83%  中位436ms  超时5次':'e.g. 2026-10-24  limit 450ms  hit 83%  median 436ms  overtime 5',
  '360° 转身需要':'360° needs',
  '导入 JSON':'Import JSON',
  '分享':'Share',
  '做完一项就在训练页点「复制本组数据」，粘到下面的记录里。':'After each drill, hit "Copy this set" on the drills page and paste it below.',
  '今天是休息日。睡够 7-8 小时，技能靠睡眠巩固。':'Rest day. Sleep 7–8 hours — skill consolidates overnight.',
  '训练器成绩会自动计入日历；把「复制本组数据」粘到这里可留档详情。':'Trainer results now count automatically; paste "Copy this set" here to archive details.',
  '请用电脑打开（建议 Chrome / Edge）·':'Open on desktop (Chrome / Edge) ·',
  '复制链接':'Copy link',
  '已复制':'Copied',
};
let LANG='zh';
const ZH={};
Object.keys(EN).forEach(k=>{ ZH[EN[k]]=k; });
const __ORIG=new WeakMap();   // 记住每个文本节点的原文，来回切换不累积
function L(zh,en){
  // 每一条经过 L() 的文案都登记进词典：切换语言的"克隆层"靠词典翻译，
  // 不登记的话这些动态文案在擦除过程中还是旧语言，完了才突然跳变。
  try{
    if(en && EN[zh]===undefined) EN[zh]=en;
    if(zh && ZH[en]===undefined) ZH[en]=zh;
  }catch(e){}
  return (LANG==='en') ? en : zh;
}
// 带数字的文案没法整句查词典，用规则（双向）
const TX_RULES=[
  [/^360° 转身需要 ([\d.]+) cm · 180° 需要 ([\d.]+) cm · 灵敏度 ([\d.]+)（m_yaw ([\d.]+) · DPI (\d+)）$/,
   m=>'360° turn needs '+m[1]+' cm · 180° needs '+m[2]+' cm · sensitivity '+m[3]+' (m_yaw '+m[4]+' · DPI '+m[5]+')'],
  [/^360° turn needs ([\d.]+) cm · 180° needs ([\d.]+) cm · sensitivity ([\d.]+) \(m_yaw ([\d.]+) · DPI (\d+)\)$/,
   m=>'360° 转身需要 '+m[1]+' cm · 180° 需要 '+m[2]+' cm · 灵敏度 '+m[3]+'（m_yaw '+m[4]+' · DPI '+m[5]+'）'],
  [/^(\d+) 球$/, m=>m[1]+' balls'],
  [/^(\d+) balls$/, m=>m[1]+' 球'],
  [/^第 (\d+) 球$/, m=>'Ball '+m[1]],
  [/^(\d{4}) 年 (\d+) 月 — (\d+) 月$/, m=>m[2]+' — '+m[3]+', '+m[1]],
  [/^(\d{4}) 年 (\d+) 月$/, m=>m[2]+', '+m[1]],
  [/^Ball (\d+)$/, m=>'第 '+m[1]+' 球'],
];
function translateRoot(root, lang){
  try{
    if(!root || !document.createTreeWalker) return;
    const map = (lang==='en') ? EN : ZH;
    const w=document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while((n=w.nextNode())){
      let orig=__ORIG.get(n);
      if(orig===undefined){ orig=n.nodeValue; __ORIG.set(n, orig); }
      const t=orig.trim();
      if(!t) continue;
      let out = map[t] ? orig.replace(t, map[t]) : orig;
      if(out===orig){
        const hasCJK=/[\u4e00-\u9fff]/.test(t);
        for(let i=0;i<TX_RULES.length;i++){
          const m=t.match(TX_RULES[i][0]);
          if(!m) continue;
          const cand=TX_RULES[i][1](m);
          // 方向必须和 lang 一致：翻成英文不能产出中文，反之亦然
          // （否则同一条规则来回翻，第二次 pass 会把刚翻好的又翻回去）
          if(lang==='en' && /[\u4e00-\u9fff]/.test(cand)) continue;
          if(lang==='zh' && !/[\u4e00-\u9fff]/.test(cand) && hasCJK) continue;
          if(lang==='zh' && /[\u4e00-\u9fff]/.test(cand) && !hasCJK) { out=cand; break; }
          out=cand; break;
        }
      }
      n.nodeValue = out;
    }
  }catch(e){}
}
function applyLang(l){
  l = l || LANG;
  document.documentElement.setAttribute('lang', l==='en'?'en':'zh-CN');
  translateRoot(document.body, l);
  // 开关状态跟 LANG 对齐（波浪没跑完也不会错位）
  try{
    document.querySelectorAll('#langSw span[data-lang]').forEach(function(el){
      el.classList.toggle('on', el.dataset.lang===l);
    });
  }catch(e){}
  // 属性文本：text 节点遍历碰不到 title / placeholder / aria-label
  // 注意：不能用 el.dataset['__o_aria-label']——键名含 "-a" 会触发 DOMStringMap SyntaxError，
  // 一旦抛错，整段属性翻译就中断（英文界面残留中文 aria-label 就是这么来的）。
  try{
    const map=(l==='en')?EN:ZH;
    document.querySelectorAll('[title],[placeholder],[aria-label]').forEach(function(el){
      const store = el.__origAttr || (el.__origAttr = {});
      ['title','placeholder','aria-label'].forEach(function(a){
        if(!el.hasAttribute(a)) return;
        if(store[a]===undefined) store[a]=el.getAttribute(a);
        const orig=store[a]||'', t=orig.trim();
        let mapped=map[t];
        if(mapped===undefined){
          // 「中文标签 + 数值」这类动态可读名（如「长度 1」「透明度 1.00」）词典里没有整串，
          // 拆成前缀+数值，前缀查词典，数值原样保留。
          const mm=/^([^\d.]+?)([\s]*[\d.]+)$/.exec(t);
          if(mm && map[mm[1].trim()]!==undefined) mapped=map[mm[1].trim()]+mm[2];
        }
        el.setAttribute(a, mapped!==undefined? mapped : orig);
      });
    });
  }catch(e){}
  // 少量静态 aria/title 不在词典里：直接按语言写死，保证英文态属性级 CJK 为 0
  try{
    var isEn = (l==='en');
    var gear = document.querySelector('.gear');
    if(gear){ gear.title = isEn?'Settings':'设置'; gear.setAttribute('aria-label', isEn?'Settings':'设置'); }
    var brand = document.querySelector('a.brand');
    if(brand){ brand.title = isEn?'Vernier':'Vernier · 分毫'; }
    document.querySelectorAll('[aria-label="关闭"],[aria-label="Close"]').forEach(function(b){
      b.setAttribute('aria-label', isEn?'Close':'关闭');
    });
    var mtClose=document.getElementById('mtClose'); if(mtClose) mtClose.setAttribute('aria-label', isEn?'Close':'关闭');
    var mtCopy=document.getElementById('mtCopy');
    if(mtCopy){ mtCopy.textContent = isEn?'Copy link':'复制链接'; }
  }catch(e){}
  // 计算出来的文案也要跟着语言走
  // ⚠ 重入保护：下面的 render 回调里可能再次调用 applyLang（render→applyLang→render 会死循环）
  window.__langBusy = true;
  try{ if(window.__updateCalc) window.__updateCalc(); }catch(e){}
  try{ if(window.__vRender) window.__vRender(); }catch(e){}
  try{ if(window.__planCalRender) window.__planCalRender(); }catch(e){}
  try{ if(window.__renderStatsBar) window.__renderStatsBar(); }catch(e){}
  // 计划页的行是渲染时用 L() 拼出来的：先重画一遍，再对全树补一次翻译，
  // 否则切完语言会留下「80 球」这种渲染期生成的残句。
  try{ if(window.__planRender) window.__planRender(); }catch(e){}
  try{ if(window.__planRowsRender) window.__planRowsRender(); }catch(e){}
  window.__langBusy = false;
  try{ translateRoot(document.body, l); }catch(e){}
}

// 默认参数必须自洽：1.92 × 0.022 × 800 DPI = 27.1 cm/360
let cfg=load(K_CFG,{dpi:800,yaw:0.022,sens:1.92,cm:27.1});

function applyTheme(id, opts){
  // opts.persist === false 时只应用不落盘（自动模式的默认值不该被写进存储）
  const persist = !(opts && opts.persist === false);
  document.documentElement.setAttribute('data-theme', id);
  if(persist) localStorage.setItem(K_THEME, id);
  // 同步给计划页 iframe（它是独立文档，不会自己更新）
  try{
    const f=document.querySelector('iframe');
    if(f && f.contentWindow) f.contentWindow.postMessage({type:'theme', theme:id}, location.origin);
  }catch(e){}
  // 趋势图颜色跟主题走
  try{
    if($('data') && $('data').classList.contains('on')) drawTrend(load(K_RUNS,[]));
  }catch(e){}
}
// —— 自动昼夜 ——
// 本地时间 06:30–18:30 用暖砂，其余用森林。getHours() 本来就是本地时区，
// 国外用户会按他自己的时间走，不需要额外换算。
const THEME_DAY_START = 6 + 30/60, THEME_DAY_END = 18 + 30/60;
function themeUserChosen(){ try{ return localStorage.getItem('cs2at.themeUser')==='1'; }catch(e){ return false; } }
function computeAutoTheme(){
  var d=new Date(), tm=d.getHours()+d.getMinutes()/60;
  return (tm>=THEME_DAY_START && tm<THEME_DAY_END) ? 'sand' : 'forest';
}
function defaultTheme(){ return computeAutoTheme(); }
function resolveTheme(){
  if(themeUserChosen()){
    var stored=null; try{ stored=localStorage.getItem(K_THEME); }catch(e){}
    return stored || computeAutoTheme();
  }
  return computeAutoTheme();          // 没有手动选择 → 每次按时间算，且不写 themeUser
}
applyTheme(resolveTheme(), {persist: themeUserChosen()});

// 外观三选：自动 / 明亮 / 深色
function themeKindOf(id){
  var t=THEMES.filter(function(x){ return x.id===id; })[0];
  return t? t.kind : 'light';
}
function syncThemeMode(){
  try{
    var manual=themeUserChosen();
    var cur=document.documentElement.getAttribute('data-theme');
    var kind=themeKindOf(cur);
    document.querySelectorAll('#themeMode .tmbtn').forEach(function(b){
      var m=b.dataset.mode;
      var on = (m==='auto') ? !manual
             : (m==='light') ? (manual && kind!=='dark')
             : (manual && kind==='dark');
      b.classList.toggle('on', !!on);
    });
    var h=document.getElementById('themeModeHint');
    if(h) h.textContent = manual ? '' : L('当前按本地时间自动切换（06:30–18:30 明亮）','Auto — switches by local time (light 06:30–18:30)');
  }catch(e){}
}
document.querySelectorAll('#themeMode .tmbtn').forEach(function(b){
  b.addEventListener('click', function(e){
    e.stopPropagation();
    var m=b.dataset.mode;
    if(m==='auto'){
      try{ localStorage.removeItem('cs2at.themeUser'); }catch(err){}
      document.documentElement.classList.add('theme-fade');
      applyTheme(computeAutoTheme(), {persist:false});
      setTimeout(function(){ document.documentElement.classList.remove('theme-fade'); }, 320);
    }else{
      try{ localStorage.setItem('cs2at.themeUser','1'); }catch(err){}
      document.documentElement.classList.add('theme-fade');
      applyTheme(m==='dark'?'forest':'sand');
      setTimeout(function(){ document.documentElement.classList.remove('theme-fade'); }, 320);
    }
    syncThemeMode(); try{ applyLang(LANG); }catch(err){}
  });
});

// tab 下划线滑动：只动 transform/width，内容不动
function moveInk(){
  try{
    const ink=document.getElementById('navInk');
    const nav=document.querySelector('nav');
    const on=document.querySelector('nav a.on');
    if(!ink||!nav) return;
    // 当前页没有对应导航项（例如设置页）→ 收起下划线，别停在上一个页签上
    if(!on){ ink.style.opacity='0'; ink.style.width='0px'; return; }
    ink.style.opacity='1';
    const nr=nav.getBoundingClientRect(), ar=on.getBoundingClientRect();
    ink.style.width=ar.width+'px';
    ink.style.transform='translateX('+(ar.left-nr.left)+'px)';
  }catch(e){}
}
addEventListener('resize', moveInk);

function show(t){
  // 无效 hash 回落到数据页，不要白屏
  if(!document.getElementById(t)) t='data';
  document.querySelectorAll('section').forEach(s=>s.classList.toggle('on', s.id===t));
  document.querySelectorAll('[data-t]').forEach(a=>a.classList.toggle('on', a.dataset.t===t));
  moveInk();
  // 计划页的行是渲染时用 L() 拼的，切到该页后补一次翻译，避免残留「80 球」
  if(t==='plan'){ try{ translateRoot(document.body, (typeof LANG!=='undefined'&&LANG==='en')?'en':'zh-CN'); }catch(e){} }
  if(t==='data') renderData();
  if(t==='play') renderDrills();
  if(t==='set')  fillSettings();
  if(t==='plan'){ try{ if(window.__planCalRender) window.__planCalRender(); }catch(e){} }
  applyLang();
  // 标题随路由与语言
  try{
    const names={data:['个人数据','My data'],play:['训练','Train'],plan:['计划','Plan'],set:['设置','Settings']};
    const n=names[t]||['分毫','Vernier'];
    document.title=(document.documentElement.getAttribute('lang')==='en'? n[1] : n[0])+' · Vernier';
  }catch(e){}
}



(function bindWhy(){
  const t=document.getElementById('playTitle');
  if(!t) return;
  let n=0;
  t.addEventListener('click',()=>{
    n++;
    if(n>=4){ location.href='关于练枪.html'; }
  });
})();

/* 主题色解析：兼容 hex 与 @property 注册后的 rgb() 计算值 */
function parseColor(v){
  try{
    var s=String(v||'').trim();
    var m=s.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if(m) return Math.round(+m[1])+','+Math.round(+m[2])+','+Math.round(+m[3]);
    var h=s.replace('#','');
    if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if(/^[0-9a-fA-F]{6}$/.test(h)){ var n=parseInt(h,16); return ((n>>16)&255)+','+((n>>8)&255)+','+(n&255); }
    return null;
  }catch(e){ return null; }
}

document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',e=>{
  if(!a.dataset.t) return;              // 外链（计划训练）走正常跳转
  e.preventDefault();
  try{ history.replaceState(null,'','#'+a.dataset.t); }catch(err){ location.hash=a.dataset.t; }
  show(a.dataset.t);
  window.scrollTo(0,0);
}));
addEventListener('hashchange',()=>show((location.hash||'#data').slice(1)));

function cfgQ(){
  const p=[];
  // 英文界面进工具页必须带 lang=en，否则英文用户点进去会看到中文
  try{ if(typeof LANG!=='undefined' && LANG==='en') p.push('lang=en'); }catch(e){}
  if(cfg.dpi) p.push('dpi='+cfg.dpi);
  if(cfg.cm)  p.push('cm='+cfg.cm);
  if(cfg.yaw) p.push('yaw='+cfg.yaw);
  if(cfg.sens)p.push('sens='+cfg.sens);
  try{
    const d=parseInt(localStorage.getItem('cs2at.delay'));
    if(!isNaN(d)) p.push('delay='+Math.max(0,Math.min(5,d)));
    const r=localStorage.getItem('cs2at.res');
    if(r){ p.push('res='+r);
      if(r==='custom'){ p.push('w='+(localStorage.getItem('cs2at.resW')||'1440')); p.push('h='+(localStorage.getItem('cs2at.resH')||'1080')); } }
    const dev=localStorage.getItem('cs2at.device');
    if(dev) p.push('device='+dev);
    if(dev==='pad'){ p.push('padMode='+(localStorage.getItem('cs2at.padMode')||'vel')); }
    if(localStorage.getItem('cs2at.crossMode')==='custom'){
      p.push('crossMode=custom');
      const cc=localStorage.getItem('cs2at.crossColor'); if(cc) p.push('crossColor='+encodeURIComponent(cc));
      const ce=localStorage.getItem('cs2at.crossEdge'); if(ce) p.push('crossEdge='+encodeURIComponent(ce));
    }
  }catch(e){}
  return p.length? '&'+p.join('&'):'';
}
function renderDrills(){
  const q=cfgQ();
  // 分组：评估 vs 练习，不再把预设和模式混成一排
  const items=[
    {g:'评估', t:'六维检查',d:'90 秒一局测六样：反应、第一枪、反应确定、微调、拉枪、稳定。打完告诉你怎么练。',
     dEN:'One 90-second run scores six skills — reaction, first shot, confirm, micro-adjust, flick, steadiness — then tells you what to train.',
     u:'tools/aim-trainer.html?mode=check&count=40&limit=0'+q},
    {g:'评估', t:'状态快测',d:'20 球无时限，球大小按命中率自适应，快速看今天手感。',
     dEN:'20 dots, no time limit — size adapts to your hit rate. A quick feel check for today.',
     u:'tools/aim-trainer.html?mode=random&count=20&limit=0&preset=state'+q},
    {g:'评估', t:'阶梯精度',d:'球按命中率自动变大变小，收敛到你 85% 命中率下的最小目标——精度阈值，可复测对比。',
     dEN:'Size adapts to your hit rate and converges on the smallest target you can hit at 85% — a repeatable precision threshold.',
     u:'tools/aim-trainer.html?mode=staircase&count=40&limit=0'+q},
    {g:'练习', t:'自适应随机',d:'球固定 1.5°，只调限时，按 85% 成功率走。主练用这个。',
     dEN:'Fixed 1.5° dots — only the time limit adjusts toward 85% success. For main practice.',
     u:'tools/aim-trainer.html?mode=random&count=40&limit=1'+q},
    {g:'练习', t:'随机距离',d:'距离 5–45° 随机、方向随机，练换距离的适应力；结果按四档距离分组对比。',
     dEN:'Distance 5–45° random, direction random — trains adaptation across distances, reported per distance bin.',
     u:'tools/aim-trainer.html?mode=distance&count=40&limit=0'+q},
    {g:'练习', t:'定角重复',d:'同一轴左右交替 8 球，形成运动程序，热身用。',
     dEN:'8 dots alternating left/right on one axis to build a motor program. For warm-up.',
     u:'tools/aim-trainer.html?mode=block&count=40&limit=0'+q},
    {g:'练习', t:'分轴定位',d:'红色竖线标出目标的水平位置，准星横向进带即刻变绿，提示你已横移到位；随后只剩垂直微调，再点击。练的是把二维瞄准拆成两段一维动作。',
     dEN:'A red vertical line marks the horizontal position of the target; the crosshair turns green the moment you slide into the band — horizontal done. Then only the vertical nudge is left, then click. Two one-dimensional actions instead of one two-dimensional aim.',
     u:'tools/aim-trainer.html?mode=axis&count=40&limit=0'+q},
    {g:'练习', t:'小球精度',d:'0.7° 小球，无时限，练一次定位的精度。',
     dEN:'0.7° dots, no limit. For one-shot precision.',
     u:'tools/aim-trainer.html?mode=precision&count=40&limit=0'+q},
    {g:'练习', t:'大角度甩枪',d:'80-160° 回头枪，练转身定位，CS 最常用的场景。',
     dEN:'80–160° turn shots — the most common CS scenario.',
     u:'tools/aim-trainer.html?mode=wide&count=30&limit=0'+q},
    {g:'练习', t:'微调训练',d:'目标匀速漂移，跟着点。VAL / APEX / OW 的核心项目。',
     dEN:'Targets drift at a steady speed — click while tracking. Core skill for VAL / APEX / OW.',
     u:'tools/aim-trainer.html?mode=track&count=30&limit=0'+q},
    {g:'评估', t:'跟枪测试',d:'90 秒跟枪，输出跟踪误差 RMS、相位滞后、速度增益——检验跟枪手感。',
     dEN:'90-second tracking: error RMS, phase lag and speed gain — test your tracking feel.',
     u:'tools/tracking-calibrator.html?'+q.slice(1)}
  ];
  // 目录式：按「练什么」分成 5 列，每项一行，首屏零滚动
  const byName={}; items.forEach(function(i){ byName[i.t]=i; });
  const GROUPS=[
    ['定位','Positioning', ['分轴定位','小球精度','阶梯精度']],
    ['速度','Speed',       ['自适应随机','随机距离','定角重复']],
    ['转向','Turning',     ['大角度甩枪']],
    ['稳定','Stability',   ['微调训练','跟枪测试']],
    ['体检','Assessment',  ['六维检查','状态快测']]
  ];
  const zhPage = document.documentElement.getAttribute('lang')!=='en';
  const today = byName['六维检查'];
  let html='';
  // 今天练什么：头部右栏的唯一入口
  const slot=$('todaySlot');
  if(slot){
    slot.innerHTML='<a class="today" href="'+(today? today.u : '#')+'">'+
      '<span class="td-l">今天练什么</span>'+
      '<span class="td-r">先从六维检查开始 <span class="ar">→</span></span></a>';
  }
  html+='<div class="cols">';
  let seq=0;                                   // 交错入场序号（跨列连续，按视觉顺序）
  GROUPS.forEach(function(g,gi){
    const num=('0'+(gi+1)).slice(-2);
    html+='<div class="col"><div class="grp" style="--gi:'+gi+'"><i>'+num+'</i>'+g[0]+'</div>';
    g[2].forEach(function(name){
      const it=byName[name];
      if(!it) return;
      const tip = zhPage ? (' title="'+String(it.d||'').replace(/"/g,'&quot;')+'"') : '';
      html+='<a class="item" href="'+it.u+'"'+tip+' style="--i:'+(seq++)+'">'+
            '<span>'+it.t+'</span><span class="ar">→</span></a>';
    });
    html+='</div>';
  });
  html+='</div>';
  $('drillGrid').innerHTML=html;
  renderStatsBar();
}

// 目录下方的紧凑状态条：最近六维 / 本周天数 / 当前灵敏度
function renderStatsBar(){
  const el=$('statsBar'); if(!el) return;
  let runs=[]; try{ runs=load(K_RUNS,[])||[]; }catch(e){}
  // 六维：最近一次 check 的总分（六项均值）
  let six='—';
  const checks=runs.filter(r=>r.mode==='check' && r.s6 && typeof r.s6==='object')
    .sort((a,b)=> new Date(a.d).getTime() - new Date(b.d).getTime());   // 按日期，取最近一次
  if(checks.length){
    const s=checks[checks.length-1].s6;
    const vals=['react','first','second','micro','wide','attn'].map(k=>+s[k]).filter(v=>isFinite(v));
    if(vals.length) six=String(Math.round(vals.reduce((a,b)=>a+b,0)/vals.length));
  }
  // 本周：最近 7 天里有训练记录的天数
  let days=0;
  try{
    const now=Date.now(), set={};
    runs.forEach(r=>{ const t=new Date(r.d).getTime(); if(isFinite(t) && now-t <= 7*86400000 && now-t >= -86400000) set[r.d]=1; });
    days=Object.keys(set).length;
  }catch(e){}
  // 灵敏度：当前 cm/360
  let cm='未设置';
  try{ const c=+cfg.cm; if(isFinite(c)&&c>0) cm=c.toFixed(1)+' cm/360'; }catch(e){}
  const en = (typeof LANG!=='undefined') ? LANG==='en' : document.documentElement.getAttribute('lang')==='en';
  const T = en
    ? { last:'Last six-skill', week:'This week', sens:'cm / 360', six:'Six-skill', day:' days', unset:'not run yet', axis:'Axis level' }
    : { last:'最近六维', week:'本周训练', sens:'灵敏度', six:'六维', day:' 天', unset:'未测', axis:'辅助等级' };
  // 辅助等级：分轴定位的渐隐等级（0–4 → A0–A4），是训练数据不是设置
  let axisLv = 0;
  try{
    const s=JSON.parse(localStorage.getItem('cs2at.axisFade')||'{}');
    if(typeof s.level==='number') axisLv=Math.max(0,Math.min(4,Math.round(s.level)));
  }catch(e){}
  const axisVal = 'A'+axisLv;
  // 记录旧值，稍后做「上浮淡出 / 下淡入」
  const prev={};
  el.querySelectorAll('.num').forEach(function(n,i){ prev[i]=n.textContent; });
  const cmNum = (cm!=='未设置')? (+cfg.cm) : null;
  el.innerHTML=
    '<div class="sb"><span class="sb-k">'+T.last+'</span><span class="sb-v'+(six==='—'?' dim':'')+'">'+(six==='—'
        ? '<span class="u" style="font-size:15px">'+T.unset+'</span>'
        : '<span class="num" data-to="">'+six+'</span><span class="u"> / 100</span>')+'</span></div>'+
    '<div class="sb"><span class="sb-k">'+T.week+'</span><span class="sb-v'+(days?'':' dim')+'"><span class="num" data-to="'+days+'">'+days+'</span><span class="u">'+T.day+'</span></span></div>'+
    '<div class="sb"><span class="sb-k">'+T.sens+'</span><span class="sb-v'+(cm==='未设置'?' dim':'')+'">'+(cm==='未设置'?T.unset:'<span class="num" data-to="'+(cmNum||0)+'" data-dec="1">'+cmNum.toFixed(1)+'</span><span class="u"> cm/360</span>')+'</span></div>'+
    '<div class="sb"><span class="sb-k">'+T.axis+'</span><span class="sb-v"><span class="num">'+axisVal+'</span></span></div>';
  // C. 数字滚动：先量终值宽度锁住，再从 0 滚上去（只改文字，不动布局）
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 数字变了：旧值上浮淡出，新值从下淡入（160ms，tabular-nums，不动布局）
  if(!reduce){
    el.querySelectorAll('.num').forEach(function(node,i){
      const before=prev[i];
      if(before===undefined || before===node.textContent) return;
      const ghost=document.createElement('span');
      ghost.className='num-ghost'; ghost.textContent=before;
      node.appendChild(ghost);
      node.classList.add('flip');
      setTimeout(function(){ ghost.remove(); node.classList.remove('flip'); }, 200);
    });
  }
  el.querySelectorAll('.num[data-to]').forEach(function(node){
    const to = parseFloat(node.dataset.to);
    if(!isFinite(to)) return;
    const dec = +(node.dataset.dec||0);
    const fmt = function(v){ return dec? v.toFixed(dec) : String(Math.round(v)); };
    if(reduce){ node.textContent = fmt(to); return; }
    node.style.minWidth = Math.ceil(node.getBoundingClientRect().width) + 'px';
    const t0 = performance.now();
    (function step(now){
      const k = Math.min(1, (now - t0) / 600);
      const e = 1 - Math.pow(1 - k, 3);            // easeOutCubic
      node.textContent = fmt(to * e);
      if(k < 1) requestAnimationFrame(step); else node.textContent = fmt(to);
    })(t0);
  });
}
window.__renderStatsBar = renderStatsBar;

// 最佳 = 持久 best 与有效 runs 合并：历史最佳不丢，raw 不可比记录不参与
// 状态快测与自适应随机在数据层分开：preset=state 的 run 归入 random|state
const runKey=r=> (r.preset==='state')? 'random|state' : r.mode;
const MODE_NAME2={};
const MODE_NAME_EN={random:'Adaptive random', block:'Fixed angle', axis:'Axis-staged', precision:'Precision', wide:'Wide flick', track:'Micro-adjust', check:'Check-up'};
function modeName(k){
  if(k==='random|state') return document.documentElement.getAttribute('lang')==='en'? 'State check' : '状态快测';
  const en = document.documentElement.getAttribute('lang')==='en';
  return en ? (MODE_NAME_EN[k]||k) : (MODE_NAME[k]||k);
}
function mergeBest(runs){
  const stored=load(K_BEST,{});
  const merged={};
  Object.keys(stored).forEach(k=>{ merged[k]=Object.assign({}, stored[k]); });
  (runs||[]).filter(r=>r.raw!==false).forEach(r=>{
    const k2=runKey(r);
    const m=merged[k2]||(merged[k2]={bestLimit:0,bestHit:0,bestMT:0,bestRadius:0,runs:0});
    if(!(m.bestLimit>0)||(r.limit>0&&r.limit<m.bestLimit)) m.bestLimit=r.limit;
    if(!(m.bestHit>0)||((r.hit||0)>m.bestHit)) m.bestHit=r.hit;
    if(!(m.bestMT>0)||((r.mt||0)<m.bestMT)) m.bestMT=r.mt;
    if(!(m.bestRadius>0)||((r.radius>0)&&r.radius<m.bestRadius)) m.bestRadius=r.radius;
    m.runsFresh=(m.runsFresh||0)+1;   // 只记本次合并的有效样本数，不污染 stored best 的 runs
  });
  return merged;
}
function renderData(){
  const runs=load(K_RUNS,[]);
  const best=mergeBest(runs);
  // 原始输入不可比（raw=false）的记录只显示在列表，不参与任何统计
  const valid=runs.filter(r=>r.raw!==false);
  $('sRuns').textContent=runs.length;
  $('sDays').textContent=new Set(runs.map(r=>r.d)).size;
  let minL=null, maxH=null;
  Object.keys(best).forEach(k=>{ const b=best[k];
    if(b.bestLimit>0 && (minL===null||b.bestLimit<minL)) minL=b.bestLimit;
    if(b.bestHit>0 && (maxH===null||b.bestHit>maxH)) maxH=b.bestHit;
  });
  var limEl=$('sLimit'), hitEl=$('sHit');
  if(limEl){ limEl.textContent = minL===null?'未测':minL+' ms'; limEl.classList.toggle('dim', minL===null); }
  if(hitEl){ hitEl.textContent = maxH===null?'未测':maxH+'%'; hitEl.classList.toggle('dim', maxH===null); }

  let rows='<tr><th>模式</th><th>最佳命中</th><th>最佳用时</th><th>最佳难度</th></tr>';
  const keys=Object.keys(best);
  if(!keys.length) rows+='<tr><td colspan="4" style="color:var(--dim)">还没有数据，去练一组吧</td></tr>';
  const diff=(k,b)=>{
    if(k==='random|state') return b.bestRadius>0? b.bestRadius+'°' : '—';   // 状态快测：可比的是球半径
    if(k==='random') return b.bestLimit>0? b.bestLimit+' ms' : '—';          // 自适应随机：可比的是最低限时
    return b.bestRadius>0? b.bestRadius+'°' : '—';                            // 固定难度模式：球大小
  };
  keys.forEach(k=>{ const b=best[k];
    rows+='<tr><td>'+modeName(k)+'</td><td class="big">'+(b.bestHit||'—')+'%</td><td>'+(b.bestMT||'—')+' ms</td><td>'+diff(k,b)+'</td></tr>'; });
  $('bestTable').innerHTML=rows;
  const bHint=$('bestHint');
  if(bHint) bHint.textContent=L('自适应模式命中率被控制在 85% 左右，可比的是「最佳难度」；固定难度模式看命中率。','Adaptive modes hold ~85% hit rate — compare "Best difficulty" instead; fixed modes compare hit rate.');

  let rr='<tr><th>日期</th><th>模式</th><th>难度</th><th>命中率</th><th>中位用时</th><th><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">删除</span></th></tr>';
  const tailAll=runs.map((r,idx)=>({r:r,idx:idx})).reverse();
  const tail = runShowAll? tailAll : tailAll.slice(0,5);
  if(!tail.length) rr+='<tr><td colspan="6" style="color:var(--dim)">暂无记录</td></tr>';
  tail.forEach(o=>{ const r=o.r;
    const diffTxt=r.limit>0? r.limit+' ms' : (r.radius>0? r.radius+'°' : '—');
    rr+='<tr><td>'+r.d+(r.raw===false? ' <span title="'+(document.documentElement.getAttribute('lang')==='en'?'Raw input unavailable':'原始输入不可用')+'">⚠</span>':'')+'</td><td>'+modeName(runKey(r))+'</td><td>'+diffTxt+
      '</td><td>'+r.hit+'%</td><td>'+r.mt+' ms</td>'+
      '<td style="text-align:right"><button class="delRun" data-i="'+o.idx+'" style="background:transparent;border:none;color:var(--dim);cursor:pointer;font-size:12px;padding:0 4px">✕</button></td></tr>'; });
  $('runTable').innerHTML=rr;
  const mr=$('moreRuns');
  if(mr) mr.textContent = (tailAll.length>5)? (runShowAll? L('收起 ▴','Collapse ▴') : L('全部 ▾','All ▾')) : '';
  if(mr) mr.style.display = tailAll.length>5? '' : 'none';

  // 结论卡：本周 vs 上周
  {
    const wk0=[], wk1=[], nowD=new Date();
    runs.forEach(r=>{ try{ const days=Math.floor((nowD.getTime()-new Date(r.d).getTime())/86400000);
      if(days>=0&&days<7) wk0.push(r); else if(days>=7&&days<14) wk1.push(r); }catch(e){} });
    const avgH=a=> a.length? Math.round(a.reduce((x,y)=>x+y.hit,0)/a.length) : null;
    const avgM=a=> a.length? Math.round(a.reduce((x,y)=>x+y.mt,0)/a.length) : null;
    const h0a=avgH(wk0.filter(r=>r.raw!==false)), h1a=avgH(wk1.filter(r=>r.raw!==false)),
          m0a=avgM(wk0.filter(r=>r.raw!==false)), m1a=avgM(wk1.filter(r=>r.raw!==false));
    let verdict;
    if(wk0.length){
      const h0=h0a, h1=h1a, m0=m0a, m1=m1a;
      const parts=[L('本周 ','This week ')+wk0.length+L(' 组',' sets')];
      if(h0!==null && h1!==null) parts.push(L('命中率 ','hit rate ')+(h0-h1>=0?'+':'')+(h0-h1)+'%');
      if(m0!==null && m1!==null) parts.push(L('中位用时 ','median ')+(m0-m1>=0?'+':'')+(m0-m1)+' ms');
      parts.push(h1===null? L('（上周没记录，从这周开始累计）','(no last week — baseline from here)') : L('（对比上周）',' (vs last week)'));
      verdict=parts.join(' · ');
      $('dataVerdict').textContent=verdict;
    } else {
      $('dataVerdict').innerHTML=L('这周还没练。','Nothing this week yet.')+' '+
        '<a href="#play" style="color:var(--acc);text-decoration:none;font-weight:600">'+L('去练一组 →','Start a set →')+'</a>　'+
        '<a href="#set" style="color:var(--dim);text-decoration:none">'+L('先去标定','Calibrate first')+'</a>';
    }
  }

  drawTrend(valid);
  drawS6Trend(valid);
}

/* 趋势曲线：按模式分线（混在一起会骗人）——命中率（左轴 0-100%）+ 中位用时/限时（右轴 ms） */
const MODE_EN={random:'Adaptive random', block:'Fixed angle', axis:'Axis-staged', precision:'Precision', wide:'Wide flick', track:'Micro-adjust', check:'Check-up'};
let trendMode=null;
let runShowAll=false;
function drawTrend(runs){
  const cv=$('trendCv'); if(!cv) return;
  const sel=$('trendMode');
  const EN_UI=document.documentElement.getAttribute('lang')==='en';
  const usedModes=Object.keys(MODE_NAME).filter(m=>runs.some(r=>r.mode===m));
  if(sel && sel.options.length===0 && usedModes.length){
    usedModes.forEach(m=>{
      const o=document.createElement('option');
      o.value=m; o.textContent=EN_UI? (MODE_EN[m]||m) : MODE_NAME[m];
      sel.appendChild(o);
    });
  }
  if(!trendMode || usedModes.indexOf(trendMode)<0) trendMode = runs.length? runs[runs.length-1].mode : null;
  if(sel && trendMode) sel.value=trendMode;
  const tail=runs.filter(r=>r.mode===trendMode).slice(-60);
  const W=Math.max(320, cv.clientWidth||600), H=220, dpr=window.devicePixelRatio||1;
  cv.width=W*dpr; cv.height=H*dpr;
  const ctx=cv.getContext('2d'); ctx.scale(dpr,dpr); ctx.clearRect(0,0,W,H);
  const css=getComputedStyle(document.documentElement);
  const acc=css.getPropertyValue('--acc').trim()||'#7fbfa6';
  const dim=css.getPropertyValue('--dim').trim()||'#8b949e';
  const line=css.getPropertyValue('--line').trim()||'#2a3a36';
  // 中位用时线颜色按主题挑，避免与命中率线（--acc）撞色：
  // 暖砂/明亮（红/蓝 acc）→ 墨绿；湖泊/墨鱼（青 acc）→ 橙；深色主题 → 琥珀
  const mtC=css.getPropertyValue('--gold').trim()||'var(--gold)';
  const P={l:46,r:44,t:10,b:26};
  const cw=W-P.l-P.r, ch=H-P.t-P.b;
  // 网格：左轴 0-100%，右轴 0-900ms
  ctx.strokeStyle=line; ctx.lineWidth=1; ctx.font='11px "Microsoft YaHei UI"';
  for(let i=0;i<=4;i++){
    const y=P.t+ch-ch*i/4;
    ctx.beginPath(); ctx.moveTo(P.l,y); ctx.lineTo(W-P.r,y); ctx.stroke();
    ctx.textAlign='right'; ctx.fillStyle=dim; ctx.fillText(String(i*25), P.l-8, y+4);
    ctx.textAlign='left';  ctx.fillText(String(i*225), W-P.r+6, y+4);
  }
  // 轴标题
  ctx.textAlign='left'; ctx.fillStyle=dim;
  ctx.fillText(EN_UI? 'hit rate %' : '命中率 %', P.l, P.t+10);
  ctx.textAlign='right';
  ctx.fillText(EN_UI? 'time ms' : '用时 ms', W-P.r, P.t+10);
  if(!tail.length){
    ctx.fillStyle=dim; ctx.textAlign='center'; ctx.font='13px "Microsoft YaHei UI"';
    ctx.fillText(EN_UI? 'No data for this mode yet' : '这个模式还没有数据', W/2, P.t+ch/2);
    $('trendLegend').innerHTML='';
    return;
  }
  const x=i=>P.l+cw*(tail.length===1? 0.5 : i/(tail.length-1));
  const linePath=(vals,ymin,ymax)=>{
    ctx.beginPath();
    vals.forEach((v,i)=>{ const y=P.t+ch*(1-(Math.min(ymax,Math.max(ymin,v))-ymin)/(ymax-ymin)); i? ctx.lineTo(x(i),y): ctx.moveTo(x(i),y); });
    ctx.stroke();
  };
  // 中位用时 + 限时（右轴 0-900ms）
  ctx.strokeStyle=mtC; ctx.lineWidth=1.6;
  linePath(tail.map(r=>r.mt),0,900);
  ctx.strokeStyle=dim; ctx.lineWidth=1.2; ctx.setLineDash([5,4]);
  linePath(tail.map(r=>r.limit),0,900);
  ctx.setLineDash([]);
  // 命中率（左轴 0-100%）
  ctx.strokeStyle=acc; ctx.lineWidth=2;
  linePath(tail.map(r=>r.hit),0,100);
  // 首尾日期
  ctx.fillStyle=dim; ctx.textAlign='left'; ctx.font='11px "Microsoft YaHei UI"';
  ctx.fillText(tail[0].d, P.l, H-8);
  ctx.textAlign='right'; ctx.fillText(tail[tail.length-1].d, W-P.r, H-8);
  // 图例
  const lg=(c,zh,en)=>'<span style="white-space:nowrap;margin-right:16px"><span style="display:inline-block;width:10px;height:3px;background:'+c+';vertical-align:middle;margin-right:6px"></span>'+(EN_UI?en:zh)+'</span>';
  $('trendLegend').innerHTML=lg(acc,'命中率','Hit rate')+lg(mtC,'中位用时','Median time')+lg(dim,'限时','Limit');
}
// 一键存图：把趋势 canvas 连同站名/日期画进一张干净的 PNG
function exportTrend(){
  const src=$('trendCv'); if(!src) return;
  const EN_UI=document.documentElement.getAttribute('lang')==='en';
  const css=getComputedStyle(document.documentElement);
  const bg=css.getPropertyValue('--panel').trim()||'#ffffff';
  const fg=css.getPropertyValue('--txt').trim()||'#1b1a17';
  const dimC=css.getPropertyValue('--dim').trim()||'#57534b';
  const lineC=css.getPropertyValue('--line').trim()||'#d8cfbc';
  const pad=32, W=1200;
  const chartW=W-pad*2;
  const chartH=Math.round(chartW * (src.height/src.width || 0.366));
  const headH=104, footH=56;
  const c=document.createElement('canvas');
  c.width=W; c.height=headH+chartH+footH;
  const g=c.getContext('2d');
  g.fillStyle=bg; g.fillRect(0,0,c.width,c.height);
  // 站名
  g.fillStyle=fg; g.font='700 30px "Microsoft YaHei UI","Segoe UI",sans-serif'; g.textAlign='left';
  g.fillText('Vernier 分毫', pad, 50);
  // 日期 + 模式
  const d=new Date(); const pad2=n=>String(n).padStart(2,'0');
  const today=d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
  const modeTxt=trendMode ? ((EN_UI? (MODE_EN[trendMode]||trendMode) : (MODE_NAME[trendMode]||trendMode))) : (EN_UI? 'all modes':'全部模式');
  g.fillStyle=dimC; g.font='14px "Microsoft YaHei UI","Segoe UI",sans-serif';
  g.fillText((EN_UI? 'Trend · ':'趋势 · ')+modeTxt+(EN_UI? ' · ':' · ')+today, pad, 78);
  // 顶部细线
  g.strokeStyle=lineC; g.lineWidth=1;
  g.beginPath(); g.moveTo(pad,90); g.lineTo(W-pad,90); g.stroke();
  // 图
  g.drawImage(src, pad, headH-6, chartW, chartH);
  // 页脚
  g.beginPath(); g.moveTo(pad, headH+chartH+6); g.lineTo(W-pad, headH+chartH+6); g.stroke();
  g.fillStyle=dimC; g.font='12px "Microsoft YaHei UI","Segoe UI",sans-serif';
  g.textAlign='left';  g.fillText('i11usoryCat · cs2-aim-tools', pad, headH+chartH+34);
  g.textAlign='right'; g.fillText(EN_UI? 'all data stays local':'数据全部留在本地', W-pad, headH+chartH+34);
  // 下载
  const name='vernier-trend-'+today+'.png';
  try{ window.__lastTrendPng=c.toDataURL('image/png'); }catch(e){}
  c.toBlob(function(blob){
    if(!blob) return;
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=name;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1000);
  },'image/png');
  return name;
}
window.__exportTrend=exportTrend;
document.addEventListener('DOMContentLoaded',function(){ var b=document.getElementById('trendSave'); if(b) b.onclick=exportTrend; });
if(document.readyState!=='loading'){ var tb=document.getElementById('trendSave'); if(tb) tb.onclick=exportTrend; }

$('trendMode').addEventListener('change',()=>{
  trendMode=$('trendMode').value;
  const runs=load(K_RUNS,[]);
  drawTrend(runs); drawS6Trend(runs);
});
// 六维走势：有 ≥2 次检查时显示六维分数折线
function drawS6Trend(runs){
  const cv=$('s6Cv'), lg=$('s6Legend');
  if(!cv) return;
  const arr=runs.filter(r=>r.mode==='check' && r.s6 && typeof r.s6==='object').slice(-20);
  const card=$('s6Card');
  if(arr.length<2){ cv.style.display='none'; if(lg) lg.style.display='none'; if(card) card.style.display='none'; return; }
  cv.style.display='block'; if(lg) lg.style.display=''; if(card) card.style.display='';
  const dpr=window.devicePixelRatio||1;
  const W=cv.clientWidth||600, H=170;
  cv.width=W*dpr; cv.height=H*dpr;
  const ctx=cv.getContext('2d'); ctx.scale(dpr,dpr);
  const DIMS=[['react','反应'],['first','第一枪'],['second','反应确定'],['micro','微调'],['wide','拉枪'],['attn','稳定']];
  /* 六维系列色与网格/刻度色一律取主题令牌（和主趋势图同一套），不再自带固定调色板 */
  const tks=getComputedStyle(document.documentElement);
  const tok=(n,fb)=>{ const v=tks.getPropertyValue(n).trim(); return v||fb; };
  const COL=[tok('--acc','#58a6ff'),tok('--gold','#d29922'),tok('--ok','#3fb950'),tok('--warn','#b45309'),tok('--acc2','#c084fc'),tok('--dim','#8b949e')];
  ctx.strokeStyle=tok('--line','rgba(128,128,128,.25)'); ctx.lineWidth=1;
  ctx.font='10px sans-serif'; ctx.textAlign='right';
  for(let g=0;g<=100;g+=25){ const y=H-10-(g/100)*(H-28);
    ctx.beginPath(); ctx.moveTo(40,y); ctx.lineTo(W-8,y); ctx.stroke();
    ctx.fillStyle=tok('--dim','rgba(150,150,150,.9)'); ctx.fillText(String(g),34,y+3);
  }
  const n=arr.length;
  const X=i=>40+(n===1? (W-48)/2 : i*(W-48)/(n-1));
  const Y=v=>H-10-(Math.max(0,Math.min(100,v===null||v===undefined?0:v))/100)*(H-28);
  DIMS.forEach((dim,di)=>{
    const vals=arr.map(r=>(typeof r.s6[dim[0]]==='number')? r.s6[dim[0]] : null);
    ctx.strokeStyle=COL[di]; ctx.lineWidth=1.6;
    ctx.beginPath();
    let started=false;
    vals.forEach((v,i)=>{ if(v===null){ started=false; return; }
      if(!started){ ctx.moveTo(X(i),Y(v)); started=true; } else ctx.lineTo(X(i),Y(v)); });
    ctx.stroke();
  });
  const EN_UI=document.documentElement.getAttribute('lang')==='en';
  const EN2={react:'Reaction',first:'First shot',second:'Confirm',micro:'Micro',wide:'Flick',attn:'Steady'};
  lg.innerHTML=DIMS.map((dim,i)=>'<span style="white-space:nowrap;margin-right:14px"><span style="display:inline-block;width:10px;height:3px;background:'+COL[i]+';vertical-align:middle;margin-right:5px"></span>'+(EN_UI? EN2[dim[0]] : dim[1])+'</span>').join('');
}
$('moreRuns').addEventListener('click',()=>{ runShowAll=!runShowAll; renderData(); });
// 重算最佳：只从本地有效记录重建，清掉历史 best 里可能的旧 raw 污染
$('rebuildBest').addEventListener('click',()=>{
  if(!confirm(L('从本地记录重算最佳？历史最佳将被覆盖。','Rebuild best from local runs? Historical best will be overwritten.'))) return;
  const runs=load(K_RUNS,[]);
  const best={};
  runs.filter(r=>r.raw!==false).forEach(r=>{
    const k2=runKey(r);
    const m=best[k2]||(best[k2]={bestLimit:0,bestHit:0,bestMT:0,bestRadius:0,runs:0});
    if(!(m.bestLimit>0)||(r.limit>0&&r.limit<m.bestLimit)) m.bestLimit=r.limit;
    if(!(m.bestHit>0)||((r.hit||0)>m.bestHit)) m.bestHit=r.hit;
    if(!(m.bestMT>0)||((r.mt||0)<m.bestMT)) m.bestMT=r.mt;
    if(!(m.bestRadius>0)||((r.radius>0)&&r.radius<m.bestRadius)) m.bestRadius=r.radius;
    m.runs=(m.runs||0)+1;
  });
  save(K_BEST,best); renderData();
});

$('runTable').addEventListener('click',e=>{
  const b=e.target.closest('.delRun'); if(!b) return;
  if(!confirm(L('删除这条记录？','Delete this run?'))) return;
  const runs=load(K_RUNS,[]);
  runs.splice(parseInt(b.dataset.i),1);
  save(K_RUNS,runs);
  // 重算最佳：持久 best 与剩余有效记录合并（删掉的是最佳也不丢历史，raw 不参与）
  save(K_BEST, mergeBest(runs)); renderData();
});

// 完整备份的键位清单：成绩、计划、主题、场景、准星、特效、设备全含
const ALL_KEYS=[K_CFG,K_BEST,K_RUNS,K_THEME,K_SCENE,'cs2at.log','cs2at.start','cs2at.scene','cs2at.sceneUser','cs2at.game',
  'cs2at.device','cs2at.padMode','cs2at.delay','cs2at.res','cs2at.resW','cs2at.resH',K_PERF,K_FPS,K_FPSSHOW,'cs2at.ballTex',
  'cs2at.crossType','cs2at.crossDyn','cs2at.crossMode','cs2at.crossColor','cs2at.crossEdge','cs2at.crossLen','cs2at.crossWid',
  'cs2at.crossGap','cs2at.crossAlpha','cs2at.crossDot','cs2at.crossOutline','cs2at.dotSize','cs2at.dotOutline',
  'cs2at.hitFx','cs2at.hitFxMix','cs2at.hitCross','cs2at.hitCrossColor',
  'cs2at.plans','cs2at.lang','cs2at.sceneCustom','cs2at.mtClosed'];
$('expBtn').addEventListener('click',()=>{
  try{
    const o={v:1,exported:new Date().toISOString()};
    ALL_KEYS.forEach(k=>{ const v=localStorage.getItem(k); if(v!==null) o[k]=v; });
    const blob=new Blob([JSON.stringify(o,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download='cs2-aim-tools-'+new Date().toISOString().slice(0,10)+'.json'; a.click();
    $('impHint').textContent=L('已导出完整备份 ✓','Full backup exported ✓');
    setTimeout(()=>{ $('impHint').textContent=''; },2500);
  }catch(e){}
});
$('impFile').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return; const rd=new FileReader();
  rd.onload=()=>{
    try{
      const d=JSON.parse(rd.result);
      if(!d || typeof d!=='object') throw 0;
      let cnt=0;
      if(d.v===1){
        ALL_KEYS.forEach(k=>{
          if(typeof d[k]!=='string') return;
          if(k===K_RUNS){ try{ if(!Array.isArray(JSON.parse(d[k]))) return; }catch(e){ return; } }
          localStorage.setItem(k,d[k]); cnt++;
        });
      } else {
        // 旧格式：顶层直接放 cfg/best/runs（runs 必须是真的数组）
        [['cfg',K_CFG],['best',K_BEST],['runs',K_RUNS]].forEach(p=>{
          if(d[p[0]] && typeof d[p[0]]==='object'){
            if(p[0]==='runs' && !Array.isArray(d.runs)) return;
            save(p[1],d[p[0]]); cnt++;
          }
        });
      }
      cfg=load(K_CFG,cfg); renderData(); fillSettings();
      $('impHint').textContent=L('已恢复 '+cnt+' 项 ✓','Restored '+cnt+' items ✓');
      setTimeout(()=>{ $('impHint').textContent=''; },2500);
    }catch(err){
      $('impHint').textContent=L('文件格式不对，没有改动任何数据。','Invalid file — nothing was changed.');
      setTimeout(()=>{ $('impHint').textContent=''; },2500);
    }
  };
  rd.readAsText(f);
});
$('clrBtn').addEventListener('click',()=>{
  if(!confirm(L('清空所有训练数据（成绩、记录、计划进度）？设置会保留。','Clear all training data (scores, log, plan progress)? Settings are kept.'))) return;
  [K_BEST,K_RUNS,'cs2at.log','cs2at.start'].forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} }); renderData();
});

function num(el,def){ const v=parseFloat(el.value); return isFinite(v)? v: def; }
function updateCalc(){
  const d=num($('iDpi'),800), y=num($('iYaw'),0.022), c=num($('iCm'),27.1), s=num($('iSens'),1.92)/gameScale();
  if(!isFinite(s)||s<=0){ $('calcHint').textContent=''; return; }
  $('calcHint').textContent = L(
    '360° 转身需要 '+c.toFixed(1)+' cm · 180° 需要 '+(c/2).toFixed(1)+' cm · 灵敏度 '+s.toFixed(2)+'（m_yaw '+y+' · DPI '+d+'）',
    '360° turn needs '+c.toFixed(1)+' cm · 180° needs '+(c/2).toFixed(1)+' cm · sensitivity '+s.toFixed(2)+' (m_yaw '+y+' · DPI '+d+')'
  );
}
window.__updateCalc=updateCalc;
function fillSettings(){
  $('iDpi').value=cfg.dpi; $('iYaw').value=cfg.yaw; $('iSens').value=cfg.sens; $('iCm').value=cfg.cm;
  $('iPerf').checked=localStorage.getItem(K_PERF)==='1';
  $('iFps').value=localStorage.getItem(K_FPS)||'0';
  $('iFpsShow').checked=localStorage.getItem(K_FPSSHOW)!=='0';
  try{
    const d=parseInt(localStorage.getItem('cs2at.delay'));
    $('iDelay').value = isNaN(d)? 3 : Math.max(0,Math.min(5,d));
    const r=localStorage.getItem('cs2at.res')||'4:3';
    $('iRes').value = ['16:9','16:10','4:3','5:4','1:1','custom'].indexOf(r)>=0? r : '4:3';
    $('iResW').value = localStorage.getItem('cs2at.resW')||'1440';
    $('iResH').value = localStorage.getItem('cs2at.resH')||'1080';
    $('resCustom').style.display = ($('iRes').value==='custom')? '' : 'none';
    const g=localStorage.getItem('cs2at.game');
    $('iGame').value = ['cs2','val','apex','ow2','r6'].indexOf(g)>=0? g : 'cs2';
    const dev=localStorage.getItem('cs2at.device')||'mouse';
    $('iDev').value = ['mouse','pad','pen'].indexOf(dev)>=0? dev : 'mouse';
    const pm=localStorage.getItem('cs2at.padMode');
    $('iPadMode').value = ['vel','abs','raw'].indexOf(pm)>=0? pm : 'vel';
    $('padSet').style.display = ($('iDev').value==='pad')? '' : 'none';
    const cm=localStorage.getItem('cs2at.crossMode')==='custom'? 'custom':'scene';
    $('iCrossMode').value=cm;
    $('crossCustom').style.display = cm==='custom'? '' : 'none';
    $('iCrossColor').value=localStorage.getItem('cs2at.crossColor')||'#3fb950';
    $('iCrossEdge').value=localStorage.getItem('cs2at.crossEdge')||'#000000';
    syncCrossUI();
    syncGameScale(true);   // 打开设置页只对齐显示，不刷提示行
  }catch(e){}
  updateScenePrev();

  const theme=localStorage.getItem(K_THEME)||defaultTheme();
  function swHTML(list){ return list.map(t=>'<div class="sw'+(t.id===theme?' on':'')+'" data-th="'+t.id+'" tabindex="0" role="button">'+
    '<span class="dot" data-theme="'+t.id+'"></span>'+t.name+'</div>').join(''); }
  $('thRec').innerHTML   = swHTML(THEMES.filter(t=>t.kind==='rec'));
  $('thLight').innerHTML = swHTML(THEMES.filter(t=>t.kind==='light'));
  $('thDark').innerHTML  = swHTML(THEMES.filter(t=>t.kind==='dark'));
  document.querySelectorAll('.sw[data-th]').forEach(el=>el.addEventListener('click',()=>{
    try{ localStorage.setItem('cs2at.themeUser','1'); }catch(e){}   // 手动选过就锁定
    applyTheme(el.dataset.th); fillSettings(); try{ applyLang(LANG); }catch(err){}
    syncThemeMode();
  }));

  const scene=localStorage.getItem(K_SCENE)||'classic';
  $('scenes').innerHTML=SCENES.map(t=>'<div class="sw'+(t.id===scene?' on':'')+'" data-sc="'+t.id+'" tabindex="0" role="button">'+
    '<span class="dot" data-scene="1" style="background:'+t.dot+'"></span>'+t.name+'</div>').join('');
  document.querySelectorAll('.sw[data-sc]').forEach(el=>el.addEventListener('click',()=>{
    localStorage.setItem(K_SCENE, el.dataset.sc);
    localStorage.setItem('cs2at.sceneUser','1');   // 手动选过的场景，训练器不再跟随主题
    fillSettings(); try{ applyLang(LANG); }catch(err){}
    updateScenePrev();
  }));

  updateCalc();
  try{ syncThemeMode(); }catch(e){}
}
function persistCfg(){
  const d=cv(num($('iDpi'),800),800), y=cv(num($('iYaw'),0.022),0.022);
  const c=cv(parseFloat($('iCm').value), 27.1);
  const shown=parseFloat($('iSens').value);
  // 显示值是"当前游戏刻度"，内部统一存本站刻度；空/0 不覆盖已有值
  const internal=(isFinite(shown)&&shown>0)? shown/gameScale() : cfg.sens;
  cfg={dpi:d, yaw:y, sens:Math.round(internal*10000)/10000, cm:Math.round(c*100)/100};
  save(K_CFG,cfg);
  // 非 CS2 游戏：把当前显示的（该游戏刻度的）灵敏度也记一份，重载/切回来都不丢
  if(gameYaw()>0 && isFinite(shown) && shown>0){ try{ localStorage.setItem(sensKey(currentGame()), String(shown)); }catch(e){} }
}
// 标定卡带当前设置参数（DPI/yaw/cm/sens），标定器按真值换算
(function(){
  try{
    const q=cfgQ();
    document.querySelectorAll('a[data-cal]').forEach(function(a){
      const base=a.getAttribute('href');
      a.setAttribute('href', base+(base.indexOf('?')>=0? q : '?'+q.slice(1)));
    });
  }catch(e){}
})();

// 换算用的是"当前游戏的有效 yaw"：CS2 = m_yaw 字段；VAL/OW2/R6 用它自己的 yaw。
// 之前这里写死 iYaw，选了非 Source 游戏后 cm↔灵敏度 会按错的角度换算。
function effYaw(){
  const gy=gameYaw();
  const y=num($('iYaw'),0.022);
  return cv(gy>0? gy : y, 0.022);
}
function cv(v, def){ return (isFinite(v)&&v>0)? v : def; }
['iDpi','iYaw','iSens','iCm'].forEach(id=>{
  $(id).addEventListener('input',()=>{
    const d=cv(num($('iDpi'),800),800), y=effYaw();
    if(id==='iSens'){
      const s=parseFloat($('iSens').value);
      if(isFinite(s)&&s>0) $('iCm').value=(914.4/(s*y*d)).toFixed(1);
    }
    if(id==='iCm'){
      const c=parseFloat($('iCm').value);
      if(isFinite(c)&&c>0) $('iSens').value=(914.4/(c*y*d)).toFixed(2);
    }
    if(id==='iDpi'||id==='iYaw'){
      // 改 DPI / m_yaw 时保持 cm/360 不变（同一只手的瞄感不能因为换硬件就变），反推灵敏度
      const c=parseFloat($('iCm').value);
      if(isFinite(c)&&c>0) $('iSens').value=(914.4/(c*y*d)).toFixed(2);
    }
    updateCalc();
    persistCfg();   // 灵敏度卡：改动即存，不用翻到底
  });
});
// 全部设置改动即存，不再有保存按钮
function chkSave(id,key){ const el=document.getElementById(id); if(!el) return;
  el.addEventListener('change',()=>{ try{ localStorage.setItem(key, el.checked? '1':'0'); }catch(e){} }); }
function valSave(id,key){ const el=document.getElementById(id); if(!el) return;
  el.addEventListener('change',()=>{ try{ localStorage.setItem(key, el.value); }catch(e){} }); }
chkSave('iPerf',K_PERF); chkSave('iFpsShow',K_FPSSHOW);
valSave('iFps',K_FPS); valSave('iRes','cs2at.res');
function saveDelay(){
  const el=$('iDelay'); const v=parseInt(el.value);
  const clamped=isNaN(v)? 3 : Math.max(0,Math.min(5,v));
  el.value=String(clamped);
  try{ localStorage.setItem('cs2at.delay', String(clamped)); }catch(e){}
}
$('iDelay').addEventListener('change', saveDelay);
$('iDelay').addEventListener('blur', saveDelay);
valSave('iDev','cs2at.device'); valSave('iPadMode','cs2at.padMode');
$('iDelay').addEventListener('input',saveDelay);
$('iResW').addEventListener('change',()=>{ try{ localStorage.setItem('cs2at.resW', $('iResW').value); }catch(e){} });
$('iResH').addEventListener('change',()=>{ try{ localStorage.setItem('cs2at.resH', $('iResH').value); }catch(e){} });
$('defBtn').addEventListener('click',()=>{
  if(!confirm(L('恢复全部默认设置？训练数据保留。','Reset all settings to default? Training data is kept.'))) return;
  cfg={dpi:800,yaw:0.022,sens:1.92,cm:27.1}; save(K_CFG,cfg);
  localStorage.removeItem(K_THEME); applyTheme(defaultTheme());
  localStorage.setItem(K_SCENE,'classic');
  ['cs2at.scene','cs2at.sceneUser','cs2at.game',K_PERF,K_FPS,K_FPSSHOW,'cs2at.delay',
   'cs2at.res','cs2at.resW','cs2at.resH','cs2at.device','cs2at.padMode',
   'cs2at.crossType','cs2at.crossDyn','cs2at.crossMode','cs2at.crossColor','cs2at.crossEdge',
   'cs2at.crossLen','cs2at.crossWid','cs2at.crossGap','cs2at.crossAlpha','cs2at.crossDot','cs2at.crossOutline',
   'cs2at.dotSize','cs2at.dotOutline','cs2at.hitFx','cs2at.hitFxMix','cs2at.hitCross','cs2at.hitCrossColor']
    .forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
  // 每款游戏各自记的灵敏度（cs2at.sens.*）也要清，否则重置后切回 VAL 会冒出旧值
  try{ Object.keys(localStorage).forEach(k=>{ if(k.indexOf('cs2at.sens.')===0) localStorage.removeItem(k); }); }catch(e){}
  fillSettings();
});
$('iRes').addEventListener('change',()=>{ $('resCustom').style.display = $('iRes').value==='custom' ? '' : 'none'; });
$('iDev').addEventListener('change',()=>{
  $('padSet').style.display = $('iDev').value==='pad'? '' : 'none';
});

/* 准星：样式/尺寸/颜色可调，预览与训练器同源渲染 */
const XG=function(k,d){ try{ const v=localStorage.getItem(k); return v===null? d : v; }catch(e){ return d; } };
function crossCol(){
  try{
    const cm=XG('cs2at.crossMode','scene')==='custom';
    const sc=(SCENES.find(s=>s.id===(localStorage.getItem(K_SCENE)||'classic')))||SCENES[0];
    const gs=(window.GAME_SCENES&&window.GAME_SCENES[sc.id])||{};
    const cc=cm? (XG('cs2at.crossColor',gs.cross||'#3fb950')) : (gs.cross||'#3fb950');
    const ce=cm? (XG('cs2at.crossEdge',gs.edge||'#000000')) : (gs.edge||'#000000');
    return {cc:cc, ce:ce, gs:gs};
  }catch(e){ return {cc:'#3fb950', ce:'#000000', gs:{}}; }
}
function updateScenePrev(){
  try{
    const c=crossCol();
    $('scenePrev').style.background=c.gs.bg||'#0b0f14';
    $('prevDot').style.background=c.gs.tgtFill||'rgba(248,81,73,.3)';
    $('prevDot').style.borderColor=c.gs.ring||'#fff';
    const type=XG('cs2at.crossType','cross');
    const len=Math.max(1,Math.min(40,parseInt(XG('cs2at.crossLen','1'))||1));
    const wid=Math.max(1,Math.min(16,parseInt(XG('cs2at.crossWid','1'))||1));
    const gap=Math.max(0,Math.min(20,parseInt(XG('cs2at.crossGap','4'))||0));
    const hasDot=XG('cs2at.crossDot','1')==='1';
    const outl=XG('cs2at.crossOutline','1')==='1';
    const box=$('prevCross');
    if(type==='dot'){
      const r=(XG('cs2at.dotSize','small')==='large'?6:3);
      const dotOutl=XG('cs2at.dotOutline','1')==='1';
      let h='';
      if(dotOutl) h+='<div style="position:absolute;left:50%;top:50%;width:'+((r+1.5)*2)+'px;height:'+((r+1.5)*2)+'px;margin-left:-'+(r+1.5)+'px;margin-top:-'+(r+1.5)+'px;border-radius:50%;background:'+c.ce+'"></div>';
      h+='<div style="position:absolute;left:50%;top:50%;width:'+(r*2)+'px;height:'+(r*2)+'px;margin-left:-'+r+'px;margin-top:-'+r+'px;border-radius:50%;background:'+c.cc+'"></div>';
      box.innerHTML=h;
    } else {
      const sh=outl? ('0 0 0 1px '+c.ce) : 'none';
      let h='';
      // 四条：transform 精确定位，奇数粗细也绝对对称
      [['H',-1],['H',1],['V',-1],['V',1]].forEach(function(a){
        const hor=a[0]==='H';
        const off=(gap+len/2);
        h+='<div style="position:absolute;left:50%;top:50%;background:'+c.cc+';box-shadow:'+sh+';'+
          (hor
            ? 'width:'+len+'px;height:'+wid+'px;transform:translate(-50%,-50%) translateX('+(a[1]<0? -off : off)+'px)'
            : 'width:'+wid+'px;height:'+len+'px;transform:translate(-50%,-50%) translateY('+(a[1]<0? -off : off)+'px)')+'"></div>';
      });
      if(hasDot){
        // 中心点：小方块（不圆），粗细与十字线一致，描边也覆盖它
        let s=Math.max(2, wid); if(s%2) s++;
        h+='<div style="position:absolute;left:50%;top:50%;width:'+s+'px;height:'+s+'px;transform:translate(-50%,-50%);background:'+c.cc+';box-shadow:'+sh+'"></div>';
      }
      box.innerHTML=h;
      const al=Math.max(0.2,Math.min(1,parseFloat(XG('cs2at.crossAlpha','1'))||1));
      box.style.opacity=String(al);
    }
  }catch(e){}
}
function syncCrossUI(){
  try{
    const type=XG('cs2at.crossType','cross');
    $('iCrossType').value = type==='dot'? 'dot' : 'cross';
    $('crossParams').style.display = type==='dot'? 'none' : '';
    $('dotParams').style.display  = type==='dot'? '' : 'none';
    $('iCrossDyn').value = XG('cs2at.crossDyn','static');
    $('iDotSize').value = XG('cs2at.dotSize','small');
    $('iCrossLen').value=XG('cs2at.crossLen','1'); $('vCrossLen').textContent=$('iCrossLen').value;
    $('iCrossWid').value=XG('cs2at.crossWid','1');   $('vCrossWid').textContent=$('iCrossWid').value;
    $('iCrossGap').value=XG('cs2at.crossGap','4');   $('vCrossGap').textContent=$('iCrossGap').value;
    const al=Math.max(0.2,Math.min(1,parseFloat(XG('cs2at.crossAlpha','1'))||1));
    $('iCrossAlpha').value=String(al); $('vCrossAlpha').textContent=al.toFixed(2);
    $('iCrossDot').checked=XG('cs2at.crossDot','1')==='1';
    $('iCrossOutline').checked=XG('cs2at.crossOutline','1')==='1';
    $('iDotOutline').checked=XG('cs2at.dotOutline','1')==='1';
    // 命中特效组合：展开勾选
    const mix=XG('cs2at.hitFxMix','11');
    $('mixFlash').checked=mix.charAt(0)==='1';
    $('mixShatter').checked=mix.charAt(1)==='1';
    $('hitFxMix').style.display = ($('iHitFx').value==='both')? 'inline-flex' : 'none';
    let fx=XG('cs2at.hitFx','flash'); if(fx==='0') fx='off'; if(fx==='1') fx='flash';
    $('iHitFx').value=['flash','shatter','both','off'].indexOf(fx)>=0? fx : 'flash';
    let hc=XG('cs2at.hitCross','auto'); if(hc==='0') hc='off'; if(hc==='1') hc='auto';
    $('iHitCross').value=['auto','custom','off'].indexOf(hc)>=0? hc : 'auto';
    $('iHitCrossColor').value=XG('cs2at.hitCrossColor','#ffffff');
    $('hitCrossColorRow').style.display = ($('iHitCross').value==='custom')? '' : 'none';
  }catch(e){}
}
$('iCrossType').addEventListener('change',()=>{
  try{ localStorage.setItem('cs2at.crossType', $('iCrossType').value); }catch(e){}
  syncCrossUI(); updateScenePrev();
});
$('iCrossDyn').addEventListener('change',()=>{ try{ localStorage.setItem('cs2at.crossDyn', $('iCrossDyn').value); }catch(e){} });
$('iDotSize').addEventListener('change',()=>{ try{ localStorage.setItem('cs2at.dotSize', $('iDotSize').value); }catch(e){} updateScenePrev(); });
function slider(id,key,labelId){
  const el=document.getElementById(id);
  if(!el) return;
  el.addEventListener('input',()=>{
    const lb=document.getElementById(labelId); if(lb) lb.textContent=el.value;
    try{ localStorage.setItem(key, el.value); }catch(e){}
    updateScenePrev();
  });
}
slider('iCrossLen','cs2at.crossLen','vCrossLen');
slider('iCrossWid','cs2at.crossWid','vCrossWid');
slider('iCrossGap','cs2at.crossGap','vCrossGap');
$('iCrossAlpha').addEventListener('input',()=>{
  try{ localStorage.setItem('cs2at.crossAlpha', $('iCrossAlpha').value); }catch(e){}
  $('vCrossAlpha').textContent=parseFloat($('iCrossAlpha').value).toFixed(2);
  updateScenePrev();
});
function chk(id,key){ const el=document.getElementById(id); if(!el) return; el.addEventListener('change',()=>{ try{ localStorage.setItem(key, el.checked?'1':'0'); }catch(e){} updateScenePrev(); }); }
chk('iCrossDot','cs2at.crossDot');
chk('iCrossOutline','cs2at.crossOutline');
chk('iDotOutline','cs2at.dotOutline');
$('iHitFx').addEventListener('change',()=>{
  try{ localStorage.setItem('cs2at.hitFx',$('iHitFx').value); }catch(e){}
  $('hitFxMix').style.display = ($('iHitFx').value==='both')? 'inline-flex' : 'none';
});
function saveMix(){ try{ localStorage.setItem('cs2at.hitFxMix', ($('mixFlash').checked?'1':'0')+($('mixShatter').checked?'1':'0')); }catch(e){} }
$('mixFlash').addEventListener('change',saveMix);
$('mixShatter').addEventListener('change',saveMix);
$('iHitCross').addEventListener('change',()=>{
  try{ localStorage.setItem('cs2at.hitCross',$('iHitCross').value); }catch(e){}
  $('hitCrossColorRow').style.display = ($('iHitCross').value==='custom')? 'flex' : 'none';
});
$('iHitCrossColor').addEventListener('input',()=>{ try{ localStorage.setItem('cs2at.hitCrossColor',$('iHitCrossColor').value); }catch(e){} });
$('iCrossMode').addEventListener('change',()=>{
  $('crossCustom').style.display = $('iCrossMode').value==='custom'? '' : 'none';
  try{ localStorage.setItem('cs2at.crossMode', $('iCrossMode').value); }catch(e){}
  updateScenePrev();
});
$('iCrossColor').addEventListener('input',()=>{
  try{ localStorage.setItem('cs2at.crossColor', $('iCrossColor').value); localStorage.setItem('cs2at.crossMode','custom'); }catch(e){}
  $('crossCustom').style.display=''; updateScenePrev();
});
$('iCrossEdge').addEventListener('input',()=>{
  try{ localStorage.setItem('cs2at.crossEdge', $('iCrossEdge').value); localStorage.setItem('cs2at.crossMode','custom'); }catch(e){}
  $('crossCustom').style.display=''; updateScenePrev();
});

/* 准星分享码：只包含准星，不含场景 */
function crossCode(){
  const cc=(XG('cs2at.crossColor','')||'').replace('#','').toUpperCase();
  const ce=(XG('cs2at.crossEdge','')||'').replace('#','').toUpperCase();
  return 'X1|'+[XG('cs2at.crossType','cross'),XG('cs2at.crossLen','1'),XG('cs2at.crossWid','1'),XG('cs2at.crossGap','4'),
    XG('cs2at.crossDot','1'),XG('cs2at.crossOutline','1'),XG('cs2at.crossDyn','static'),XG('cs2at.dotSize','small'),XG('cs2at.dotOutline','1'),
    XG('cs2at.crossMode','scene'),cc,ce].join('|');
}
$('sceneShare').addEventListener('click',()=>{
  const code=crossCode();
  $('sceneShareHint').textContent=L('准星分享码：','Crosshair share code: ')+code;
  try{ navigator.clipboard.writeText(code).catch(()=>{}); }catch(e){}
});
$('sceneImport').addEventListener('click',()=>{
  const raw=(prompt(L('粘贴准星分享码','Paste crosshair share code'))||'').trim();
  if(!raw) return;
  const p=raw.split('|');
  if(p[0]!=='X1'||p.length<11){ $('sceneShareHint').textContent=L('格式不对','Invalid code'); return; }
  if(['cross','dot'].indexOf(p[1])<0){ $('sceneShareHint').textContent=L('格式不对','Invalid code'); return; }
  try{
    const keys=['cs2at.crossType','cs2at.crossLen','cs2at.crossWid','cs2at.crossGap','cs2at.crossDot','cs2at.crossOutline','cs2at.crossDyn','cs2at.dotSize','cs2at.dotOutline'];
    p.slice(1,10).forEach(function(v,i){ localStorage.setItem(keys[i], v); });
    localStorage.setItem('cs2at.crossMode', p[10]==='custom'? 'custom' : 'scene');
    if(p[11]&&/^[0-9A-Fa-f]{6}$/.test(p[11])) localStorage.setItem('cs2at.crossColor','#'+p[11].toLowerCase());
    if(p[12]&&/^[0-9A-Fa-f]{6}$/.test(p[12])) localStorage.setItem('cs2at.crossEdge','#'+p[12].toLowerCase());
    fillSettings(); updateScenePrev();
    $('sceneShareHint').textContent=L('已导入准星','Crosshair imported');
  }catch(e){ $('sceneShareHint').textContent=L('格式不对','Invalid code'); }
});

/* 游戏灵敏度切换：先选游戏，再改灵敏度；点「更改灵敏度」按该游戏换算，DPI 不动。
   yaw 表经 KovaaK / Ubisoft 官方 / keymap.io 交叉核对。cs2 即本站刻度（1:1） */
const GAME_YAW={'cs2':0,'val':0.07,'apex':0.022,'ow2':0.0066,'r6':0.00572957795};
function gameYaw(){ const v=GAME_YAW[$('iGame').value]; return v===undefined? 0 : v; }
function gameScale(){ const gy=gameYaw(); if(gy===0) return 1; const sy=num($('iYaw'),0.022)||0.022; return sy/gy; }
function applyGameSens(quiet){
  // 按当前所选游戏换算并落盘，DPI 不动；quiet 时不刷提示行
  try{
    const gy=gameYaw(), sy=num($('iYaw'),0.022)||0.022;
    const scale = gy===0 ? 1 : sy/gy;
    const disp=parseFloat($('iSens').value);
    if(!isFinite(disp)||disp<=0) return;   // 无效输入不动
    const dpi=num($('iDpi'),800);
    const internal = disp/scale;                       // 本站灵敏度
    const cm = 914.4/(disp*(gy===0? sy : gy)*dpi);     // 真实 cm/360，DPI 不动
    cfg.sens=Math.round(internal*10000)/10000; cfg.cm=Math.round(cm*100)/100;
    cfg.dpi=dpi; cfg.yaw=sy;
    if(!quiet) save(K_CFG,cfg);   // 只在用户操作时落盘；打开设置页的对齐只改显示
    if(!quiet){ try{ localStorage.setItem(sensKey(currentGame()), String(disp)); }catch(e){} }   // 记住这款游戏的灵敏度
    $('iSens').value=String(disp); $('iCm').value=String(cfg.cm);
    if(!quiet){
      $('gameConvHint').textContent=L('已切换：cm/360 ','Switched: cm/360 ')+cfg.cm+L(' · 本站灵敏度 ',' · site sensitivity ')+cfg.sens.toFixed(4)+L('，DPI '," (DPI ")+dpi+L(' 不变',' unchanged)');
    }
    updateCalc();
  }catch(e){}
}
function syncYawVisible(){
  try{
    const gy=gameYaw();
    const show = (gy===0 || gy===0.022);   // CS2/CS:GO 与 Apex（Source 系）支持 m_yaw
    $('yawBox').style.display = show? '' : 'none';
  }catch(e){}
}
// 每款游戏各自的灵敏度记一份，切回来不会丢（以前是强制写 0）
function sensKey(g){ return 'cs2at.sens.'+g; }
function currentGame(){ return ($('iGame') && $('iGame').value) || 'cs2'; }
function storedGameSens(g){ try{ const v=parseFloat(localStorage.getItem(sensKey(g))); return (isFinite(v)&&v>0)? v : null; }catch(e){ return null; } }
function syncGameScale(quiet){
  try{
    const name=$('iGame').selectedOptions[0].textContent;
    $('sensLabel').textContent = L('灵敏度 · ','Sensitivity · ')+name;
    syncYawVisible();
    if(gameYaw()===0){
      // CS2/CS:GO = 本站刻度：直接显示当前灵敏度并落盘
      $('iSens').value = String(cfg.sens);
      applyGameSens(quiet);
    } else {
      // 其他游戏：显示上次为这款游戏存下的值；没有就留空（留空 ≠ 0）
      const v=storedGameSens(currentGame());
      $('iSens').value = (v!==null)? String(v) : '';
      updateCalc();
    }
  }catch(e){}
}
$('iGame').addEventListener('change',()=>{
  try{
    const prev=localStorage.getItem('cs2at.game')||'cs2';
    const now=currentGame();
    const v=parseFloat($('iSens').value);
    if(prev!==now && isFinite(v)&&v>0) localStorage.setItem(sensKey(prev), String(v));  // 先存住上一款游戏的灵敏度
    localStorage.setItem('cs2at.game', now);
  }catch(e){}
  syncGameScale();
});
$('iSens').addEventListener('change',()=>{ applyGameSens(); });

cfg=load(K_CFG,cfg);
/* 语言状态由 shell.js 接管：?lang= > cs2at.lang > 浏览器语言（与迁移前同一口径） */
LANG=(window.VernierShell && VernierShell.lang) ? VernierShell.lang.get() : 'zh';
if('scrollRestoration' in history) history.scrollRestoration='manual';
show((location.hash||'#data').slice(1));
window.scrollTo(0,0);
function fitPlanFrame(){
  const f=document.querySelector('#plan iframe');
  if(!f) return;
  try{
    const d=f.contentDocument;
    if(!d) return;
    const h=Math.max(d.documentElement.scrollHeight, d.body ? d.body.scrollHeight : 0);
    if(h>200) f.style.height=h+'px';
  }catch(e){}
}
addEventListener('message', function(e){
  if(e && e.data && e.data.type==='height' && typeof e.data.h==='number'){
    const f=document.querySelector('#plan iframe');
    if(f && e.data.h>200) f.style.height=e.data.h+'px';
  }
  if(e && e.data && e.data.type==='theme'){
    // 计划页也会主动请求主题
    try{ document.querySelector('#plan iframe').contentWindow.postMessage(
      {type:'theme', theme:document.documentElement.getAttribute('data-theme')}, location.origin); }catch(err){}
  }
});
addEventListener('resize', fitPlanFrame);

(function syncThemeToFrame(){
  const f=document.querySelector('iframe');
  if(!f) return;
  f.addEventListener('load',()=>{
    try{ f.contentWindow.postMessage({type:'theme', theme:document.documentElement.getAttribute('data-theme')}, location.origin); }catch(e){}
    fitPlanFrame();
    setTimeout(fitPlanFrame, 300);
  });
})();

/* ===== 计划训练 ===== */
function initPlan(){
(function(){
  function apply(t){ if(!t) return; document.documentElement.setAttribute('data-theme', t); }
  var q=null;
  try{ q=new URLSearchParams(location.search).get('theme'); }catch(e){}
  try{ apply(q || localStorage.getItem('cs2at.theme') || (function(){var d=new Date(),tm=d.getHours()*60+d.getMinutes();return (tm>=1410||tm<460)?'forest':'sand';})()); }catch(e){ apply('sand'); }
  addEventListener('message', function(e){
    if(e && e.data && e.data.type==='theme'){ apply(e.data.theme); }
    if(e && e.data && e.data.type==='wantTheme'){
      try{ parent.postMessage({type:'theme', theme:document.documentElement.getAttribute('data-theme')}, '*'); }catch(err){}
    }
  });

  // 高度上报给父页面，让 iframe 撑开，用主滚动条滚动
  function reportHeight(){
    try{
      var h=Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      if(parent && parent!==window) parent.postMessage({type:'height', h:h}, '*');
    }catch(err){}
  }
  addEventListener('load', function(){ reportHeight(); setTimeout(reportHeight,200); });
  if(window.ResizeObserver){ new ResizeObserver(reportHeight).observe(document.body); }
  setTimeout(reportHeight,120);
})();
const K_START='cs2at.start', K_LOG='cs2at.log', K_CFG='cs2at.cfg';
const $=id=>document.getElementById(id);
const todayStr=()=>{ const d=new Date(),p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); };
const dayIdx=()=>{ const s=localStorage.getItem(K_START); if(!s) return -1; return Math.floor((new Date(todayStr())-new Date(s))/86400000); };
const weekOf=d=>Math.min(4, Math.floor(Math.max(0,d)/7)+1);

function render(root, lang){
  const D = root || document;
  const $ = function(id){ return D.querySelector('#'+id); };
  const LG = lang || document.documentElement.getAttribute('lang');
  let d=dayIdx();
  if(d<0){
    if(root) return;
    // 只有真正打开计划页才写开始日期（不再随任意页面加载自动起跑）
    const planSec=document.getElementById('plan');
    if(planSec && planSec.classList.contains('on')){ try{ localStorage.setItem(K_START, todayStr()); }catch(e){} }
    d=0;
  }
  const w=weekOf(d);
  const log=JSON.parse(localStorage.getItem(K_LOG)||'[]');

  // 训练日集合：粘贴的记录 + 训练器成绩（cs2at.runs）自动并入——练完自动计入日历
  const set=new Set(log.map(x=>String(x||'').slice(0,10)));
  try{
    const hist=JSON.parse(localStorage.getItem(K_RUNS)||'[]');
    if(Array.isArray(hist)) hist.forEach(x=>{
      const s=String(x.d||'').slice(0,10);
      if(/^\d{4}-\d{2}-\d{2}$/.test(s)) set.add(s);
    });
  }catch(e){}
  const startT=new Date(localStorage.getItem(K_START)||todayStr()).getTime();
  let doneIn=0;
  set.forEach(k=>{ const t=new Date(k).getTime(); if(t>=startT && t<startT+28*86400000) doneIn++; });

  // 连续天数
  let streak=0;
  for(let i=0;i<60;i++){ const dt=new Date(Date.now()-i*86400000);
    const p=n=>String(n).padStart(2,'0');
    const k=dt.getFullYear()+'-'+p(dt.getMonth()+1)+'-'+p(dt.getDate());
    if(set.has(k)) streak++; else if(i>0) break; }

  // 一行说清：进行中 = 第几天；结束后 = 本轮完成 N/28
  const metaEl=$('planMeta');
  if(metaEl){
    metaEl.innerHTML = d>=28
      ? (LG==='en'
          ? 'Round complete: <b>'+doneIn+'</b> / 28 days · streak <b>'+streak+'</b>'
          : '本轮完成 <b>'+doneIn+'</b> / 28 天 · 连续 <b>'+streak+'</b> 天')
      : (LG==='en'
          ? 'Day <b>'+(d+1)+'</b> · <b>'+doneIn+'</b> days done · <b>'+streak+'</b> day streak'
          : '第 <b>'+(d+1)+'</b> 天 · 已完成 <b>'+doneIn+'</b> 天 · 连续 <b>'+streak+'</b> 天');
  }

  const isRest=((new Date().getDay()===0)||(new Date().getDay()===6));   // 周末休息，跟日历同一套
  if(d>=28){
    // 四周走完：明确收尾，不再装成进行中
    const tt=document.getElementById('planEggTitle');
    if(tt) tt.textContent=LG==='en'?'Four weeks done':'四周计划已结束';
    $('todayHint').textContent = LG==='en'
      ? 'Four weeks complete — hit "Start over (clear plan progress)" to run another round.'
      : '四周计划已走完——点「重新开始（清空计划进度）」再跑一轮。';
  } else {
    $('todayHint').textContent = isRest
      ? (LG==='en' ? 'Rest day. Sleep 7–8 hours — skill consolidates overnight.' : '今天是休息日。睡够 7-8 小时，技能靠睡眠巩固。')
      : (LG==='en' ? 'Trainer results now count automatically; paste "Copy this set" into the log to archive details.' : '训练器成绩会自动计入日历；把「复制本组数据」粘到记录里可留档详情。');
  }

  // 进度格：始终显示**当前月**（不再停在已结束那轮的 28 天窗口）
  const pd=n=>String(n).padStart(2,'0');
  const WEEK=(LG==='en')
    ? ['M','T','W','T','F','S','S'] : ['一','二','三','四','五','六','日'];
  $('calWeek').innerHTML=WEEK.map(w=>'<div>'+w+'</div>').join('');
  const nowD=new Date();
  const y0=nowD.getFullYear(), m0=nowD.getMonth();
  const lead=(new Date(y0,m0,1).getDay()+6)%7;          // 周一=0
  const dim=new Date(y0,m0+1,0).getDate();              // 当月天数
  const tk=todayStr();
  let g='';
  for(let i=0;i<lead;i++) g+='<div class="cell blank"></div>';
  for(let dnum=1;dnum<=dim;dnum++){
    const dt=new Date(y0,m0,dnum);
    const k=y0+'-'+pd(m0+1)+'-'+pd(dnum);
    const done=set.has(k);
    const rest=((dt.getDay()+6)%7)>=5;                  // 六、日
    const cls='cell'+(done?' done':rest?' rest':'')+(k===tk?' today':'');
    g+='<div class="'+cls+'" title="'+k+(done? (LG==='en'?' · done':' · 已完成'):'')+'">'+dnum+'</div>';
  }
  const total=lead+dim, tail=(7-total%7)%7;
  for(let i=0;i<tail;i++) g+='<div class="cell blank"></div>';
  $('grid').innerHTML=g;
  const EN_=LG==='en';
  const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  $('calTitle').textContent = EN_ ? M[m0]+' '+y0 : y0+' 年 '+(m0+1)+' 月';
  // 本轮已结束：禁用「标记今天完成」，避免点了没反应
  const mdEl=$('markDone');
  if(mdEl){ const over=d>=28; mdEl.disabled=over; mdEl.style.opacity=over?'.45':''; mdEl.title=over?(LG==='en'?'Round finished — start over first':'本轮已结束，先点「重新开始」'):''; }

  // 记录表
  if(log.length){
    $('logTable').innerHTML='<tr><th>'+(LG==='en'?'Date':'日期')+'</th><th>'+(LG==='en'?'Data':'数据')+'</th></tr>'+
      log.slice().reverse().slice(0,20).map(l=>'<tr><td>'+l.slice(0,10)+'</td><td>'+l.slice(10)+'</td></tr>').join('');
  } else $('logTable').innerHTML='';
}

  window.__vRender = render;   // 切换语言后重新渲染（日历/星期/月份）

$('markDone').addEventListener('click',()=>{
  if($('markDone').disabled) return;
  const log=JSON.parse(localStorage.getItem(K_LOG)||'[]');
  if(log.some(x=>x.startsWith(todayStr()))){ alert(L('今天已经标记过了','Already marked today')); return; }
  log.push(todayStr()+'  已完成');
  localStorage.setItem(K_LOG, JSON.stringify(log));
  render();
});

$('resetAll').addEventListener('click',()=>{
  if(!confirm(L('清空计划进度？训练成绩保留。','Clear plan progress? Training data is kept.'))) return;
  localStorage.removeItem(K_START); localStorage.removeItem(K_LOG);
  location.reload();
});

$('addLog').addEventListener('click',()=>{
  const v=$('logInput').value.trim(); if(!v) return;
  const log=JSON.parse(localStorage.getItem(K_LOG)||'[]');
  log.push(v); localStorage.setItem(K_LOG, JSON.stringify(log));
  $('logInput').value=''; render();
});

$('copyAll').addEventListener('click',()=>{
  const log=JSON.parse(localStorage.getItem(K_LOG)||'[]');
  const txt=log.join('\n');
  if(navigator.clipboard) navigator.clipboard.writeText(txt).then(()=>alert(L('已复制 ','Copied ')+log.length+L(' 条',' entries')));
  else alert(txt);
});

// 日历改为懒渲染：首次打开计划页才写 K_START、才画日历
window.__planCalRender=function(){ render(); };
// 直接打开 #plan 时 show() 先于 initPlan 执行——这里补一次渲染
try{
  const ps=document.getElementById('plan');
  if(ps && ps.classList.contains('on')) window.__planCalRender();
}catch(e){}
}


/* ===== 多套计划 · 可自定义 ===== */
(function(){
  const K_PLAN='cs2at.plans';
  const MODES=[
    {id:'random',    name:'自适应随机'},
    {id:'block',     name:'定角重复'},
    {id:'precision', name:'小球精度'}
  ];
  function defaults(){
    return {
      active:'p1',
      plans:[
        {id:'p1', name:'标准', rows:[{t:'热身',m:'block',s:2},{t:'主练',m:'random',s:4},{t:'精度',m:'precision',s:2}]},
        {id:'p2', name:'精简', rows:[{t:'热身',m:'block',s:1},{t:'主练',m:'random',s:2}]},
        {id:'p3', name:'加量', rows:[{t:'热身',m:'block',s:2},{t:'主练',m:'random',s:6},{t:'精度',m:'precision',s:3}]}
      ]
    };
  }
  const load=function(){
    try{
      const v=JSON.parse(localStorage.getItem(K_PLAN));
      if(v && Array.isArray(v.plans) && v.plans.length) return v;
    }catch(e){}
    return defaults();
  };
  const save=function(v){ try{ localStorage.setItem(K_PLAN, JSON.stringify(v)); }catch(e){} };
  const cur=function(st){ return st.plans.find(p=>p.id===st.active) || st.plans[0]; };
  let editingId=null;   // 哪一枚胶囊正在改名
  const isEN=function(){ return document.documentElement.getAttribute('lang')==='en'; };
  const L=function(zh,en){ return isEN()? en : zh; };
  const PLAN_ZH={'标准':'Standard','精简':'Lite','加量':'Heavy'};
  const ROW_ZH={'热身':'Warm-up','主练':'Main','精度':'Accuracy','新项目':'New item',
    '自适应随机':'Adaptive random','定角重复':'Fixed angle','小球精度':'Precision'};
  const dispName=function(n){ return isEN() && PLAN_ZH[n] ? PLAN_ZH[n] : n; };
  const dispRow=function(n){ return isEN() && ROW_ZH[n] ? ROW_ZH[n] : n; };

  function render(){
    try{ window.__planRowsRender=render; }catch(e){}   // 切语言后要能重画行
    const st=load();
    const box=document.getElementById('planRows');
    const chips=document.getElementById('planPresets');
    if(!box||!chips) return;
    const plan=cur(st);

    // 计划选择器
    chips.innerHTML=st.plans.map(function(p){
      if(p.id===editingId){
        return '<input class="chipIn" data-edit="'+p.id+'" value="'+p.name+'" maxlength="10">';
      }
      return '<button class="chip'+(p.id===plan.id?' on':'')+'" data-plan="'+p.id+'" title="'+L('双击改名','Double-click to rename')+'">'+dispName(p.name)+'</button>';
    }).join('') + '<button class="chip new" data-new="1">＋ 新建</button>';

    // 操作行：改名 / 删除
    const ops=document.getElementById('planOps');
    if(ops){
      const empty=!plan.rows.length;
      ops.innerHTML='<span data-rename="1">改名</span>'+
        '<span data-share="1"'+(empty?' class="off" title="'+L('没有项目可分享','Nothing to share yet')+'"':'')+'>分享</span>'+
        '<span data-import="1">导入</span>'+
        (st.plans.length>1?'<span class="warn right" data-delplan="1">删除这套计划</span>':'');
      const rn=ops.querySelector('[data-rename]');
      if(rn) rn.onclick=function(){
        editingId=cur(load()).id; render();
        const inp=document.querySelector('.chipIn');
        if(inp){ inp.focus(); inp.select(); }
      };
      const dp=ops.querySelector('[data-delplan]');
      if(dp) dp.onclick=function(){
        const v=load();
        if(v.plans.length<=1) return;
        if(!window.confirm(L('删除「'+dispName(cur(v).name)+'」？','Delete "'+dispName(cur(v).name)+'"?'))) return;
        v.plans=v.plans.filter(x=>x.id!==v.active);
        v.active=v.plans[0].id; save(v); render();
      };
    }

    // 分享 / 导入
    const sb=document.getElementById('shareBox');
    // 分享码：名字是默认的就不带，改过才带
    //   全默认 → V1b2r4p2                      (8 字符)
    //   有自定义 → V1|<名字>b2|甲r4|p2          (自动加长)
    const M2C={block:'b', random:'r', precision:'p'};
    const C2M={b:'block', r:'random', p:'precision'};
    const DEF={block:['热身','Warm-up'], random:['主练','Main'], precision:['精度','Accuracy']};
    const isDefName=function(n, mode){
      if(!n) return true;
      const d=DEF[mode]||[];
      return d.indexOf(n)>=0;
    };

    function encAuto(pl){
      const rowsAreDefault=pl.rows.every(function(r){ return isDefName(r.t, r.m); });
      const nameDefault=!pl.name || ['标准','精简','加量','Standard','Lite','Heavy'].indexOf(pl.name)>=0;
      if(rowsAreDefault && nameDefault){
        return 'V1' + pl.rows.map(function(r){ return (M2C[r.m]||'r')+(r.s||1); }).join('');
      }
      const clean=function(t){ return String(t||'').replace(/[|]/g,''); };
      return 'V1' + (nameDefault?'':clean(pl.name)) + '|' +
        pl.rows.map(function(r){
          return (isDefName(r.t,r.m)?'':clean(r.t)) + (M2C[r.m]||'r') + (r.s||1);
        }).join('|');
    }

    function decAny(code){
      const raw=String(code).trim();
      if(raw.slice(0,2)!=='V1') throw new Error(L('要以 V1 开头','Must start with V1'));
      const rows=[]; let name='';

      if(raw.indexOf('|')>=0){
        const parts=raw.split('|');
        name=(parts.shift()||'').replace(/^V1/,'').trim();
        parts.forEach(function(seg){
          if(!seg) return;
          const m=seg.match(/^(.*?)([brp])(\d{1,2})$/);
          if(m) rows.push({t:(m[1]||'').slice(0,8), m:C2M[m[2]], s:Math.max(1,Math.min(20,+m[3]))});
        });
      }else{
        const body=raw.replace(/^V1/,'').replace(/[\s,，]/g,'');
        let i=0;
        while(i<body.length){
          const c=body[i];
          if(!C2M[c]) throw new Error(L('无法识别的字符 ','Unrecognized character ')+c);
          i++; let num='';
          while(i<body.length && /[0-9]/.test(body[i])){ num+=body[i]; i++; }
          const n=parseInt(num,10);
          if(!n) throw new Error(L('组数缺失','Missing set count'));
          rows.push({t:'', m:C2M[c], s:Math.max(1,Math.min(20,n))});
        }
      }
      if(!rows.length) throw new Error(L('内容为空','Empty content'));

      // 空名字 → 当前语言的默认名；重名自动编号
      const defName=function(mode){ return L(DEF[mode][0], DEF[mode][1]); };
      const seen={};
      rows.forEach(function(r){
        let base=r.t || defName(r.m);
        if(seen[base]===undefined){ seen[base]=1; r.t=base; }
        else { seen[base]++; r.t=base+' '+seen[base]; }
      });
      return {n:name, rows:rows};
    }

    function showShare(){
      const code=encAuto(plan);
      const short=code.indexOf('|')<0;
      sb.innerHTML='<div class="shareRow"><input id="shareOut" readonly value="'+code+'">'+
        '<button id="shareCopy">'+L('复制','Copy')+'</button></div>'+
        '<div class="shareTip2">'+code.length+L(' 字符 · ',' chars · ')+
        (short?L('名字都是默认的，没写进码里','All names are default — not encoded'):L('把你改过的名字也带上了','Your custom names are included'))+'</div>';
      document.getElementById('shareOut').select();
      document.getElementById('shareCopy').onclick=function(){
        const o=document.getElementById('shareOut'); o.select();
        try{ document.execCommand('copy'); }catch(e){}
        this.textContent=L('已复制','Copied'); const b=this;
        setTimeout(function(){ b.textContent=L('复制','Copy'); },1400);
      };
    }
    function showImport(){
      sb.innerHTML='<div class="shareRow"><input id="shareIn" placeholder="'+L('粘贴分享码，例如 V1b2r4p2','Paste a share code, e.g. V1b2r4p2')+'">'+
        '<button id="shareOk">'+L('导入','Import')+'</button><button id="shareCancel">'+L('取消','Cancel')+'</button></div>'+
        '<div class="shareTip" id="shareTip"></div>';
      document.getElementById('shareIn').focus();
      document.getElementById('shareCancel').onclick=function(){ sb.innerHTML=''; };
      document.getElementById('shareOk').onclick=function(){
        const raw=(document.getElementById('shareIn').value||'').trim();
        const tip=document.getElementById('shareTip');
        try{
          const obj=decAny(raw);
          const v=load(), id='p'+(Date.now()%100000);
          v.plans.push({id:id, name:(obj.n||L('分享','Shared')+(v.plans.length+1)).slice(0,10), rows:obj.rows});
          v.active=id; save(v); render();
        }catch(e){ tip.textContent=L('导入失败：','Import failed: ')+e.message; }
      };
    }

    // 行
    box.innerHTML = plan.rows.length ? plan.rows.map(function(r,i){
      return '<div class="prow">'+
        '<input class="nmIn" data-i="'+i+'" value="'+dispRow(r.t||'')+'" placeholder="'+L('项目名','Name')+'" maxlength="8">'+
        '<select data-i="'+i+'" aria-label="'+L('模式','Mode')+'">'+MODES.map(function(m){
          return '<option value="'+m.id+'"'+(m.id===r.m?' selected':'')+'>'+dispRow(m.name)+'</option>';
        }).join('')+'</select>'+
        '<div class="prowAct">'+
          '<div class="stepper">'+
            '<button data-step="-1" data-i="'+i+'">−</button>'+
            '<span>'+(r.s*40)+L(' 球',' balls')+'</span>'+
            '<button data-step="1" data-i="'+i+'">+</button>'+
          '</div>'+
          '<a class="pGo" href="tools/aim-trainer.html?mode='+r.m+'&count='+Math.min(800,Math.max(20,r.s*40))+cfgQ()+'">'+L('开始','Start')+'</a>'+
        '</div>'+
        '<button class="del" data-del="'+i+'" title="'+L('删掉这项','Delete this row')+'">×</button>'+
      '</div>';
    }).join('') : '<div class="emptyRows">'+L('还没有项目，点下面的「＋ 添加一项」开始。','No items yet — use "＋ Add a row" below.')+'</div>';

    function edit(fn){ const v=load(); fn(cur(v)); save(v); render(); }

    box.querySelectorAll('select').forEach(function(el){
      el.addEventListener('change',function(e){
        edit(function(p){ p.rows[+e.target.dataset.i].m=e.target.value; });
      });
    });
    box.querySelectorAll('.nmIn').forEach(function(el){
      el.addEventListener('input',function(e){
        const v=load(); cur(v).rows[+e.target.dataset.i].t=e.target.value.slice(0,8); save(v);
      });
    });
    box.querySelectorAll('button[data-step]').forEach(function(el){
      el.addEventListener('click',function(e){
        const i=+e.target.dataset.i, d=+e.target.dataset.step;
        edit(function(p){ p.rows[i].s=Math.max(1,Math.min(20,p.rows[i].s+d)); });
      });
    });
    box.querySelectorAll('button[data-del]').forEach(function(el){
      el.addEventListener('click',function(e){
        const i=+e.target.dataset.del;
        edit(function(p){ p.rows.splice(i,1); });
      });
    });

    const add=document.getElementById('planAdd');
    if(add) add.onclick=function(){
      edit(function(p){ p.rows.push({t:'新项目', m:'random', s:1}); });
    };

    const inp=chips.querySelector('.chipIn');
    if(inp){
      const commit=function(){
        const v=load(), pl=v.plans.find(x=>x.id===inp.dataset.edit);
        if(pl && inp.value.trim()) pl.name=inp.value.trim().slice(0,10);
        editingId=null; save(v); render();
      };
      inp.addEventListener('keydown',function(e){
        if(e.key==='Enter'){ commit(); }
        else if(e.key==='Escape'){ editingId=null; render(); }
      });
      inp.addEventListener('blur',commit);
    }

    chips.querySelectorAll('[data-plan]').forEach(function(el){
      el.addEventListener('click',function(e){
        const v=load(); v.active=e.target.dataset.plan; save(v); render();
      });
      el.addEventListener('dblclick',function(e){
        e.preventDefault();
        editingId=e.target.dataset.plan; render();
        const inp=document.querySelector('.chipIn');
        if(inp){ inp.focus(); inp.select(); }
      });
    });
    if(typeof applyLang==='function' && !window.__langBusy) applyLang();   // 新插入的文字也要翻译（避免与 applyLang 互递归）

    const sh=ops.querySelector('[data-share]');
    if(sh && !sh.classList.contains('off')) sh.onclick=showShare;
    const im=ops.querySelector('[data-import]');   if(im) im.onclick=showImport;

    const nb=chips.querySelector('[data-new]');
    if(nb) nb.onclick=function(){
      const v=load();
      const name=L('计划 ','Plan ')+(v.plans.length+1);
      const id='p'+(Date.now()%100000);
      v.plans.push({id:id, name:name, rows:[{t:'主练',m:'random',s:4}]});
      v.active=id; save(v); render();
    };
  }
  window.__planRender = render;   // 切换语言后重画计划选择器/操作行/行项目
  // 后台标签页切回时重画（训练成绩可能已经变了）
  document.addEventListener('visibilitychange', function(){
    if(!document.hidden){ try{ render(); }catch(e){} }
  });

  // 第三个彩蛋：连点「今日训练」四次 → 八个字
  (function(){
    var t=document.getElementById('planEggTitle');
    if(!t) return;
    var n=0, timer=null;
    t.addEventListener('click',function(){
      n++; clearTimeout(timer);
      timer=setTimeout(function(){ n=0; },1200);
      if(n>=4){ n=0; location.href='八个字.html'; }
    });
  })();

  render();
  document.addEventListener('click',function(e){
    if(e.target.closest('nav a[data-t="plan"]')) setTimeout(render,30);
  });
})();

/* 语言：引擎（状态/涟漪/开关接线/持久化）在 shell.js；这里只注册 app 的词典 + TX_RULES 翻译器。
   shell 切换语言时会调用 translate(lang)：同步本地 LANG → 翻译全树 → 重画当前 tab，
   回调顺序与迁移前 rippleSwitch 的 doSwap（LANG=→applyLang()→show()）一致。 */
if(window.VernierShell && VernierShell.i18n){
  VernierShell.i18n.register(EN, {
    translate: function(l){
      LANG = (l==='en') ? 'en' : 'zh';
      try{ applyLang(l); }catch(e){}
      try{ show((location.hash||'#data').slice(1)); }catch(e){}
    }
  });
  LANG = VernierShell.lang.get();
}
applyLang();
initPlan();

/* a11y：隐藏 h1、表单可读名、色块键盘可达 */
(function(){
  var h=document.createElement('h1');
  h.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
  h.textContent='Vernier';
  var hd=document.querySelector('header')||document.body;
  hd.insertBefore(h, hd.firstChild);
  // 可读名：.k 标签和「文字+控件」行都覆盖
  document.querySelectorAll('.k').forEach(function(k){
    var c=k.parentElement.querySelector('input,select');
    if(c && !c.getAttribute('aria-label')){ try{ c.setAttribute('aria-label', k.textContent.trim()); }catch(e){} }
  });
  document.querySelectorAll('select,input[type=range],input[type=color],input[type=number],input[type=text]').forEach(function(el){
    if(el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')) return;
    var p=el.parentElement;
    if(!p) return;
    var t=(p.childNodes[0]&&p.childNodes[0].nodeType===3? p.childNodes[0].textContent : '');
    t=t.trim();
    if(!t) return;
    var k=p.querySelector('.k');
    if(k) t=k.textContent.trim();
    if(t){ try{ el.setAttribute('aria-label', t); }catch(e){} }
  });
  document.addEventListener('keydown', function(e){
    var t=e.target;
    if(!t || !t.dataset) return;
    var hit=(e.key==='Enter'||e.key===' ')
      && (t.classList.contains('sw') || t.dataset.lang || t.dataset.l || t.dataset.rename || t.dataset.share || t.dataset.import || t.dataset.del || t.dataset.newPlan || t.dataset.delplan);
    if(hit){ e.preventDefault(); t.click(); }
  });
  // 语言切换与计划操作改为键盘可达
  try{
    document.querySelectorAll('#langSw span[data-lang], span[data-rename], span[data-share], span[data-import], span[data-del], span[data-newPlan], span[data-delplan]').forEach(function(el){
      el.setAttribute('tabindex','0'); el.setAttribute('role','button');
    });
  }catch(e){}
})();


/* 手机提示条：触屏且小屏时显示，复制链接 */
(function(){
  var tip=document.getElementById('mobileTip'); if(!tip) return;
  if(!(('ontouchstart' in window) || navigator.maxTouchPoints>0) || Math.min(screen.width,screen.height)>=900) return;
  try{ if(localStorage.getItem('cs2at.mtClosed')==='1') return; }catch(e){}
  tip.style.display='flex';
  var btn=document.getElementById('mtCopy');
  var close=document.getElementById('mtClose');
  if(close) close.addEventListener('click', function(){ try{ localStorage.setItem('cs2at.mtClosed','1'); }catch(e){} tip.style.display='none'; });
  var isEn=function(){ return document.documentElement.getAttribute('lang')==='en'; };
  btn.addEventListener('click', function(){
    try{ navigator.clipboard.writeText(location.href).catch(function(){}); }catch(e){}
    btn.textContent = isEn() ? 'Copied' : '已复制';
    setTimeout(function(){ btn.textContent = isEn() ? 'Copy link' : '复制链接'; }, 2000);
  });
})();
