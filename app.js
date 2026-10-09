(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const defaults = { title:'城中有声', intro:'隔一重帘，听一段唱腔；循着《张协状元》，走近温州南戏的文献与传承。', dark:.85, glow:110, duration:2.8, mist:.15, volume:.75, motion:.5, credit:'唱段版本与来源待补充', cues:[] };
  const limits = {dark:[.3,.95],glow:[40,250],duration:[1,6],mist:[0,.4],volume:[0,1],motion:[0,1]};
  const storageKey='ouyue-city-sound-v2';
  function normalize(value) {
    const c={...defaults};
    if(!value || typeof value!=='object') return c;
    for(const key of ['title','intro','credit']) if(typeof value[key]==='string') c[key]=value[key].slice(0,key==='title'?40:180);
    for(const [key,[min,max]] of Object.entries(limits)) {const n=Number(value[key]);if(Number.isFinite(n)) c[key]=Math.min(max,Math.max(min,n));}
    if(Array.isArray(value.cues)) c.cues=value.cues.filter(q=>q&&Number.isFinite(q.start)&&Number.isFinite(q.end)&&q.start>=0&&q.end>q.start&&typeof q.text==='string').map(q=>({start:q.start,end:q.end,text:q.text.slice(0,500),speaker:['贫女','张协'].includes(q.speaker)?q.speaker:''})).sort((a,b)=>a.start-b.start);
    return c;
  }
  const initial=normalize({...defaults,...window.EXHIBITION_CONFIG});
  let config={...initial}, opened=false, opening=false, timer=null, requestId=0;
  try {const saved=localStorage.getItem(storageKey);if(saved)config=normalize(JSON.parse(saved));}catch{}
  const audio=$('audio'),stage=$('stage'),viewport=$('stageViewport'),box=$('stageBox'),introShade=$('introShade'),introSkip=$('introSkip');
  const STAGE_W=1920,STAGE_H=1080;
  const time=n=>Number.isFinite(n)?`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`:'--:--';
  const status=text=>$('status').textContent=text;
  function applyConfig(syncFields=true) {
    $('title').textContent=config.title;document.title=config.title+' · 水木之间';$('intro').textContent=config.intro;$('credit').textContent=config.credit;
    const style=document.documentElement.style;
    style.setProperty('--dark',config.dark);style.setProperty('--glow',config.glow+'px');style.setProperty('--duration',config.duration+'s');style.setProperty('--mist',config.mist);style.setProperty('--angle',(.4*config.motion)+'deg');style.setProperty('--rise',(-1*config.motion)+'px');style.setProperty('--head-angle',(3*config.motion)+'deg');style.setProperty('--arm-angle',(6*config.motion)+'deg');audio.volume=config.volume;
    for(const key of Object.keys(limits)) {$(`${key}Value`).textContent=key==='glow'?config[key]+' px':key==='duration'?config[key].toFixed(1)+' 秒':Math.round(config[key]*100)+'%';if(syncFields)$(key).value=config[key];}
    if(syncFields){$('editTitle').value=config.title;$('editIntro').value=config.intro;$('editCredit').value=config.credit;}
    update();
  }
  function update(){
    const duration=audio.duration,valid=Number.isFinite(duration)&&duration>0;
    $('time').textContent=time(audio.currentTime)+' / '+time(duration);
    $('progress').disabled=!valid||!opened||opening;
    $('progress').value=valid?audio.currentTime/duration*100:0;
    $('play').textContent=opening?'正在启幕…':!opened?'开帘听戏':audio.ended?'重播唱段':audio.paused?'继续听戏':'暂停';
    $('play').disabled=opening;
    $('mute').textContent=audio.muted?'开启声音':'静音';$('mute').setAttribute('aria-pressed',String(audio.muted));
    stage.classList.toggle('playing',opened&&!audio.paused&&!audio.ended&&!opening);
    const cue=opened&&!opening?config.cues.find(q=>audio.currentTime>=q.start&&audio.currentTime<q.end):null;
    $('speaker').textContent=cue?.speaker||'';$('line').textContent=cue?.text||'';stage.dataset.speaker=cue?.speaker||'';
  }
  function fitStage(){
    if(!viewport||!box)return;
    const vw=viewport.clientWidth,vh=window.innerHeight;
    const portrait=vh>vw;
    viewport.classList.toggle('portrait',portrait);
    const scale=portrait?vw/STAGE_W:Math.min(vw/STAGE_W,viewport.clientHeight/STAGE_H);
    box.style.width=`${STAGE_W*scale}px`;
    box.style.height=`${STAGE_H*scale}px`;
    viewport.scrollLeft=0;viewport.scrollTop=0;
  }
  let introActive=!!introShade, introLeaving=false;
  const introBackground=[...document.querySelectorAll('header, main, #editor, #stageBox, .transport, .subtitles, #status')];
  function endIntro(){
    if(!introActive||introLeaving)return;
    introLeaving=true;
    introShade.classList.add('leaving');
    const complete=()=>{
      introShade.hidden=true;
      introActive=false;
      introBackground.forEach(el=>{el.inert=false;});
      document.body.classList.remove('intro-active');
      fitStage();
      $('reveal').focus({preventScroll:true});
    };
    setTimeout(complete,matchMedia('(prefers-reduced-motion: reduce)').matches?0:1600);
  }
  function startIntro(){
    if(!introShade)return;
    introBackground.forEach(el=>{el.inert=true;});
    document.body.classList.add('intro-active');
    introShade.classList.add('show');
    introSkip.focus({preventScroll:true});
    introShade.addEventListener('keydown',e=>{
      if(e.key==='Tab'){e.preventDefault();introSkip.focus();}
      if(e.key==='Escape')endIntro();
    });
  }
  async function playAudio(){
    const id=++requestId;
    try{await audio.play();if(id!==requestId)return;status('正在播放 · 你可以暂停、拖动进度，或跳过唱段。');}
    catch(error){if(id!==requestId||error.name==='AbortError')return;status(audio.error?'音频暂时无法读取，请检查 assets/excerpt.mp3。':'声音未能开始播放，请点击“继续听戏”。');}
    update();
  }
  function openCurtain(){
    if(introActive||opened)return;
    opened=true;opening=true;$('echo').hidden=true;stage.classList.remove('ended');stage.classList.add('opened');$('reveal').disabled=true;
    status('帷幕渐启，请稍候。');update();
    timer=setTimeout(()=>{opening=false;timer=null;playAudio();},matchMedia('(prefers-reduced-motion: reduce)').matches?0:config.duration*1000);
  }
  function reset(){
    requestId++;clearTimeout(timer);timer=null;audio.pause();audio.currentTime=0;opened=false;opening=false;stage.classList.remove('opened','playing','ended');$('reveal').disabled=false;$('echo').hidden=true;$('operaNotes').hidden=true;status('移动鼠标，循光看戏；也可直接点击启幕。');update();
  }
  function finish(skipped=false){
    requestId++;clearTimeout(timer);timer=null;opening=false;opened=true;audio.pause();stage.classList.add('opened','ended');$('reveal').disabled=true;$('echo').hidden=false;$('operaNotes').hidden=false;status(skipped?'已跳过唱段，可以继续走读。':'唱段已结束，余音仍在。');update();$('speaker').textContent='';$('line').textContent='';stage.dataset.speaker='';
    $('echo').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
  }
  $('reveal').onclick=openCurtain;
  $('play').onclick=()=>{if(!opened){openCurtain();return;}if(opening)return;if(audio.paused){if(audio.ended)audio.currentTime=0;stage.classList.remove('ended');$('echo').hidden=true;playAudio();}else{requestId++;audio.pause();status('已暂停，点击继续听戏。');}};
  $('reset').onclick=reset;$('skip').onclick=()=>finish(true);
  const tabs=[...document.querySelectorAll('.archive-stop')];
  function activateTab(tab,focus=false){tabs.forEach(item=>{const active=item===tab;item.classList.toggle('is-active',active);item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;const panel=$(item.dataset.panel);panel.hidden=!active;panel.classList.toggle('is-active',active);});if(focus)tab.focus();}
  tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>activateTab(tab));tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;activateTab(tabs[next],true);});});
  $('archiveReplay').onclick=()=>{reset();stage.scrollIntoView({block:'center',behavior:'smooth'});};
  $('replay').onclick=()=>{audio.currentTime=0;$('echo').hidden=true;stage.classList.remove('ended');stage.scrollIntoView({block:'center',behavior:'smooth'});playAudio();};
  $('mute').onclick=()=>{audio.muted=!audio.muted;update();};
  $('progress').oninput=()=>{if(Number.isFinite(audio.duration)&&audio.duration>0){audio.currentTime=Number($('progress').value)/100*audio.duration;stage.classList.remove('ended');$('echo').hidden=true;update();}};
  stage.onpointermove=e=>{if(opened)return;const r=stage.getBoundingClientRect();stage.style.setProperty('--x',((e.clientX-r.left)/r.width*100)+'%');stage.style.setProperty('--y',((e.clientY-r.top)/r.height*100)+'%');};
  stage.onpointerleave=()=>{stage.style.removeProperty('--x');stage.style.removeProperty('--y');};
  window.addEventListener('resize',fitStage);
  if(window.ResizeObserver&&viewport)new ResizeObserver(fitStage).observe(viewport);
  if(introSkip)introSkip.onclick=endIntro;
  for(const event of ['loadedmetadata','durationchange','timeupdate','play','pause','volumechange'])audio.addEventListener(event,update);
  audio.addEventListener('ended',()=>finish());audio.addEventListener('error',()=>status('音频无法加载；画面仍可预览，请检查音频文件。'));
  const setEditor=show=>{$('editor').hidden=!show;$('editToggle').setAttribute('aria-expanded',String(show));if(show)$('editTitle').focus();else $('editToggle').focus();};
  $('editToggle').onclick=()=>setEditor($('editor').hidden);$('editClose').onclick=()=>setEditor(false);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('editor').hidden)setEditor(false);});
  for(const [id,key] of [['editTitle','title'],['editIntro','intro'],['editCredit','credit']])$(id).oninput=()=>{config[key]=$(id).value;applyConfig(false);};
  for(const key of Object.keys(limits))$(key).oninput=()=>{config[key]=Number($(key).value);applyConfig(false);};
  $('save').onclick=()=>{try{localStorage.setItem(storageKey,JSON.stringify(config));$('editStatus').textContent='已保存在当前浏览器。公开网站未改变。';}catch{$('editStatus').textContent='浏览器不允许保存，请使用“导出设置”。';}};
  $('defaults').onclick=()=>{config=normalize(initial);try{localStorage.removeItem(storageKey);}catch{}applyConfig();$('editStatus').textContent='已恢复项目默认设置。';};
  $('export').onclick=()=>{const blob=new Blob(['// 将此文件替换项目中的 config.js，然后提交并发布。\nwindow.EXHIBITION_CONFIG = '+JSON.stringify(config,null,2)+';\n'],{type:'text/javascript;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='config.js';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('editStatus').textContent='已导出 config.js。替换项目中的同名文件后可同步到 GitHub。';};
  const timestamp=s=>{const p=s.replace(',','.').split(':').map(Number);return p.length===3?p[0]*3600+p[1]*60+p[2]:p.length===2?p[0]*60+p[1]:NaN;};
  $('subtitleFile').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    if(file.size>1000000){$('editStatus').textContent='字幕文件过大，请使用1MB以内的VTT文件。';return;}
    try{const raw=(await file.text()).replace(/^\uFEFF/,'').replace(/\r/g,'');if(!raw.startsWith('WEBVTT'))throw Error('格式');const cues=[];
      for(const block of raw.split(/\n\s*\n/)){const lines=block.split('\n');const idx=lines.findIndex(l=>l.includes('-->'));if(idx<0)continue;const [a,b]=lines[idx].split('-->').map(s=>s.trim().split(/\s+/)[0]);let text=lines.slice(idx+1).join(' ').replace(/<[^>]*>/g,'').trim();const match=text.match(/^(贫女|张协)[：:]/);cues.push({start:timestamp(a),end:timestamp(b),speaker:match?.[1]||'',text:match?text.slice(match[0].length):text});}
      const checked=normalize({...config,cues});if(!checked.cues.length)throw Error('空字幕');config=checked;update();$('editStatus').textContent=`已导入 ${config.cues.length} 条字幕。可保存到本机或导出设置。`;
    }catch{$('editStatus').textContent='未能导入，请检查WEBVTT时间格式和字幕内容。';}
  };
  applyConfig();
  fitStage();
  startIntro();
})();
