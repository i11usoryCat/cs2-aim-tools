/* 训练场景配色 —— 全站唯一一份
   由 tools/*.html 共用；此前三个文件各存一份，其中两份的 classic.cross
   误写成了 CSS 变量（canvas 不认），导致准星不显示。此处统一修正。 */
window.GAME_SCENES = {
  classic:{dark:true,ui:'#58a6ff',halo:.24,bg:'#0b0f14',major:'rgba(88,166,255,.55)',minor:'rgba(64,76,90,1)',ceil:'rgba(50,60,72,1)',
       tgt:'#f85149',tgtFill:'rgba(248,81,73,.30)',ring:'rgba(248,81,73,.95)',cross:'#3fb950',edge:'#000000'},
  lake:{dark:false,ui:'#0e7490',halo:.0,bg:'#eef4f6',major:'rgba(14,116,144,.45)',minor:'rgba(150,176,184,1)',ceil:'rgba(176,198,205,1)',
       tgt:'#0e7490',tgtFill:'rgba(14,116,144,.85)',ring:'#ffffff',cross:'#14313a',edge:'#ffffff'},
  jade:{dark:true,ui:'#7fbfa6',halo:.14,bg:'#101917',major:'rgba(127,191,166,.50)',minor:'rgba(58,84,78,1)',ceil:'rgba(44,64,60,1)',
       tgt:'#e0a458',tgtFill:'rgba(224,164,88,.85)',ring:'#fff6e6',cross:'#7fbfa6',edge:'#000000'},
  ink:{dark:true,ui:'#0f766e',halo:.16,bg:'#12181d',major:'rgba(15,118,110,.55)',minor:'rgba(58,74,82,1)',ceil:'rgba(44,58,66,1)',
       tgt:'#ffb020',tgtFill:'rgba(255,176,32,.85)',ring:'#ffffff',cross:'#ffffff',edge:'#000000'},
  light:{dark:false,ui:'#2f6feb',halo:.0,bg:'#eef1f4',major:'rgba(15,118,110,.45)',minor:'rgba(160,172,182,1)',ceil:'rgba(184,194,203,1)',
       tgt:'#e8590c',tgtFill:'rgba(232,89,12,.85)',ring:'#ffffff',cross:'#111827',edge:'#ffffff'},
  night:{dark:true,ui:'#58a6ff',halo:.20,bg:'#0b0f14',major:'rgba(88,166,255,.50)',minor:'rgba(64,76,90,1)',ceil:'rgba(50,60,72,1)',
       tgt:'#ff5f56',tgtFill:'rgba(255,95,86,.85)',ring:'#ffffff',cross:'#7ee787',edge:'#000000'},
  mono:{dark:true,ui:'#c9d1d9',halo:.26,bg:'#0f1113',major:'rgba(200,205,215,.40)',minor:'rgba(88,92,100,1)',ceil:'rgba(70,73,80,1)',
       tgt:'#ffd166',tgtFill:'rgba(255,209,102,.85)',ring:'#000000',cross:'#ffffff',edge:'#000000'},
  cs:{dark:true,ui:'#d6b578',halo:.18,bg:'#2b2620',major:'rgba(214,181,120,.45)',minor:'rgba(120,110,88,1)',ceil:'rgba(98,90,72,1)',
       tgt:'#e5484d',tgtFill:'rgba(229,72,77,.85)',ring:'#ffffff',cross:'#b8e986',edge:'#000000'}
};;

/* 站点主题 → 训练场景（界面跟主题，场景配色跟这张表） */
window.THEME2SCENE = {jade:'jade',ink:'ink',lake:'lake',light:'light',sand:'light',forest:'jade',mono:'mono',cyber:'night',night:'night'};

/* 取当前该用哪个场景：手动选过优先，否则跟站点主题 */
window.pickSceneKey = function(){
  var q; try{ q=new URLSearchParams(location.search); }catch(e){ q={get:function(){return null;}}; }
  var qs=q.get('scene');
  if(qs && window.GAME_SCENES[qs]) return qs;
  var sc=null,u=false;
  try{ sc=localStorage.getItem('cs2at.scene'); u=localStorage.getItem('cs2at.sceneUser')==='1'; }catch(e){}
  if(u && sc && window.GAME_SCENES[sc]) return sc;
  var th=null; try{ th=q.get('theme')||localStorage.getItem('cs2at.theme'); }catch(e){}
  if(th && window.THEME2SCENE[th]) return window.THEME2SCENE[th];
  if(sc && window.GAME_SCENES[sc]) return sc;
  return 'night';
};
