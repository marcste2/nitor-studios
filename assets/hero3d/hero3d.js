/* Hero: Flug durch den Raum mit den drei Arbeiten, am Ende landet das N.
   Steuerung von außen: NitorHero.start() / NitorHero.stop()
   (die Seite schaltet auf Handy und bei "weniger Bewegung" auf den statischen Hero).
   Beim Runterscrollen hält die Seite an jedem Video mindestens eine halbe Sekunde an, damit keins übersprungen wird.
   Wer nicht weiterscrollt, sieht die Szene zu Ende.
   Nach oben scrollt man frei. */
(function(){
'use strict';
var hero=document.querySelector('.hero');
if(!hero) return;
var stage=hero.querySelector('.h3-stage'), world=hero.querySelector('.h3-world');
var plH=hero.querySelector('.h3-halle'), plL=hero.querySelector('.h3-licht');
var bg=hero.querySelector('.h3-bg'), nv=hero.querySelector('.h3-nland');
var floor=hero.querySelector('.h3-floor');
var intro=hero.querySelector('.h3-intro'), hint=hero.querySelector('.h3-hint');
var cap=hero.querySelector('.h3-cap'), capN=cap.querySelector('small'), capT=cap.querySelector('span');
var fin=hero.querySelector('.h3-final');
var FRAMES=hero.getAttribute('data-frames'), FRAME_COUNT=+hero.getAttribute('data-frame-count')||0;

// Abdunkelung der Halle als eigene Ebene: Deckkraft statt Filter, das erledigt die Grafikkarte ohne Neuzeichnen
var dim=document.createElement('div'); dim.className='h3-dim'; dim.setAttribute('aria-hidden','true');
plH.parentNode.insertBefore(dim,plH.nextSibling);

var PERSP=1000, AR=3120/1328;
function vw(){return stage.clientWidth} function vh(){return stage.clientHeight}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function lerp(a,b,t){return a+(b-a)*t}
function seg(p,a,b){return clamp((p-a)/(b-a),0,1)}
function expoInOut(t){return t===0?0:t===1?1:t<.5?Math.pow(2,20*t-10)/2:(2-Math.pow(2,-20*t+10))/2}
function cubicOut(t){return 1-Math.pow(1-t,3)}

// Stilwerte nur schreiben, wenn sie sich ändern
var memo=new Map();
function setS(el,prop,val){ var m=memo.get(el); if(!m){m={};memo.set(el,m);} if(m[prop]!==val){ m[prop]=val; el.style[prop]=val; } }

/* ---------- Panels ---------- */
var panels=[].map.call(hero.querySelectorAll('.h3-panel'),function(el,i){
  var side=i%2===0?-1:1;
  return {el:el, vid:el.querySelector('video'), name:el.getAttribute('data-name')||'', playing:false,
    w:360, h:640, x:side*(420+(i%3)*120), y:(i%2?-90:110), z:-2600*(i+1), ry:side*-38, rz:side*6};
});
var N=panels.length;
var zN=-2600*(N+1)-600, floorY=380;

/* ---------- Zeitachse ---------- */
var T0=0.05, B=0.21, TR=0.08, END0=T0+N*B;
var V0=0.735, V1=0.95;
function holdDist(pn){ var s=Math.min((vh()*0.74)/pn.h,(vw()*0.62)/pn.w); return PERSP/s; }
function holdPose(i,t){
  var pn=panels[i], d=holdDist(pn);
  return {x:pn.x+lerp(-18,18,t)*(i%2?1:-1), y:pn.y+lerp(8,-8,t), z:pn.z+d+lerp(60,-60,t), roll:lerp(-1.2,1.2,t)*(i%2?1:-1)};
}
function endPose(t){ return {x:0,y:floorY-420,z:zN+2300-lerp(0,220,t),roll:0}; }
function camAt(p){
  if(p<T0){ var t0=seg(p,0,T0); return {x:0,y:lerp(-40,-20,t0),z:lerp(900,700,t0),roll:0}; }
  for(var i=0;i<N;i++){
    var b0=T0+i*B, tEnd=b0+TR, hEnd=b0+B;
    if(p<tEnd){
      var from=i===0?{x:0,y:-20,z:700,roll:0}:holdPose(i-1,1), to=holdPose(i,0);
      var t=expoInOut(seg(p,b0,tEnd)), sw=Math.sin(Math.PI*seg(p,b0,tEnd));
      return {x:lerp(from.x,to.x,t)+sw*(i%2?-160:160), y:lerp(from.y,to.y,t)-sw*60, z:lerp(from.z,to.z,t), roll:lerp(from.roll,to.roll,t)+sw*(i%2?-9:9)};
    }
    if(p<hEnd) return holdPose(i,seg(p,tEnd,hEnd));
  }
  var travelEnd=END0+0.05;
  if(p<travelEnd){
    var f=holdPose(N-1,1), e=endPose(0), te=expoInOut(seg(p,END0,travelEnd)), s2=Math.sin(Math.PI*seg(p,END0,travelEnd));
    return {x:lerp(f.x,e.x,te), y:lerp(f.y,e.y,te)-s2*120, z:lerp(f.z,e.z,te), roll:lerp(f.roll,0,te)+s2*-7};
  }
  return endPose(seg(p,travelEnd,1));
}
function panelState(i,p){
  var b0=T0+i*B, tEnd=b0+TR, hEnd=b0+B, pn=panels[i], face=0;
  if(p>=b0&&p<tEnd) face=cubicOut(seg(p,b0+TR*0.4,tEnd));
  else if(p>=tEnd&&p<hEnd) face=1;
  else if(p>=hEnd&&p<hEnd+TR) face=1-seg(p,hEnd,hEnd+TR*0.6);
  var spin=Math.sin(p*20+i)*6;
  return {ry:lerp(pn.ry+spin,0,face), rz:lerp(pn.rz,0,face), face:face};
}

/* ---------- Leinwände und Raumbilder ---------- */
var bctx=bg.getContext('2d'), nctx=nv.getContext('2d');
var DPR=Math.min(2,window.devicePixelRatio||1);
var BDPR=Math.min(1.5,window.devicePixelRatio||1);   // Partikel brauchen keine volle Retina-Auflösung
var lastFi=-1;
// Raumbilder in fester Pixelgröße (ihrer echten Bildgröße); bewegt und skaliert wird nur per transform
var PL_H={w:2400,h:2400/AR}, PL_L={w:2000,h:2000/AR};
function size(){
  bg.width=Math.round(vw()*BDPR); bg.height=Math.round(vh()*BDPR);
  nv.width=Math.round(vw()*DPR); nv.height=Math.round(vh()*DPR); lastFi=-1;
  plH.style.width=PL_H.w+'px'; plH.style.height=PL_H.h+'px';
  plL.style.width=PL_L.w+'px'; plL.style.height=PL_L.h+'px';
  floor.style.transform='translate3d(0px,'+floorY+'px,'+zN+'px) rotateX(90deg)';
}
function placePlate(el,base,x,y,w,h,rot){
  var s=w/base.w;
  el.style.transform='translate('+(x+w/2).toFixed(1)+'px,'+(y+h/2).toFixed(1)+'px) rotate('+rot+'deg) translate('+(-w/2).toFixed(1)+'px,'+(-h/2).toFixed(1)+'px) scale('+s.toFixed(4)+')';
}
var P=[]; for(var k=0;k<260;k++) P.push({x:Math.random()*2-1,y:Math.random()*2-1,z:Math.random(),s:Math.random()});

/* ---------- Einzelbilder der N-Landung: erst laden, wenn jemand zu scrollen beginnt ---------- */
var NIMG=[], framesStarted=false;
function pad(n){return ('00'+n).slice(-3)}
function loadFrames(){
  if(framesStarted||!FRAMES||!FRAME_COUNT) return; framesStarted=true;
  // zuerst die Bilder, die zuerst gebraucht werden (Fall und Aufprall), dann der Rest
  var order=[], seen={};
  function add(i){ if(i>=0&&i<FRAME_COUNT&&!seen[i]){seen[i]=1;order.push(i);} }
  for(var a=11;a<=26;a++) add(a);
  for(var b=0;b<FRAME_COUNT;b++) add(b);
  // nach und nach, je drei gleichzeitig und bevorzugt in Ruhephasen des Browsers, damit das Scrollen nicht stockt
  var next=0;
  function one(){
    if(next>=order.length) return;
    var i=order[next++], im=new Image();
    im.decoding='async';
    im.onload=im.onerror=function(){
      im.ok=im.naturalWidth>0;
      if(im.ok&&p>=V0-0.02){ lastFi=-1; kick(); }   // neu zeichnen nur, wenn die N-Landung gerade zu sehen ist
      idle(one);
    };
    im.src=FRAMES+pad(i)+'.jpg'; NIMG[i]=im;
  }
  one(); idle(one); idle(one);
}
var idle=window.requestIdleCallback?function(cb){ requestIdleCallback(cb,{timeout:120}); }:function(cb){ setTimeout(cb,40); };
function frameNear(fi){ for(var d=0;d<FRAME_COUNT;d++){ var a=NIMG[fi-d]; if(a&&a.ok) return fi-d; var b=NIMG[fi+d]; if(b&&b.ok) return fi+d; } return -1; }

/* ---------- Zustand ---------- */
var p=0, target=0, last=null, vel=0, running=false, active=false, onScreen=true, lastCap=-2, lastT=0;
// Leichte Fassung für langsame Rechner: bleibt die Bildrate in Bewegung länger unter 25/s, entfallen Unschärfe und große Schatten
var lite=false, slowMs=0;
var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function calcTarget(){ var r=hero.getBoundingClientRect(), total=hero.offsetHeight-innerHeight; return total>0?clamp(-r.top/total,0,1):0; }
function onResize(){ if(lock) release(false); size(); target=calcTarget(); prevTarget=target; kick(); }
function kick(){ if(active&&onScreen&&!running){ running=true; lastT=0; requestAnimationFrame(frame); } }

function setPlaying(pn,want){
  if(!pn.vid||pn.playing===want) return;
  pn.playing=want;
  if(want){ pn.vid.muted=true; var pr=pn.vid.play(); if(pr&&pr.catch) pr.catch(function(){ pn.playing=false; }); }
  else pn.vid.pause();
}

function frame(now){
  if(!active||!onScreen){ running=false; lastT=0; return; }
  // Bewegung an die echte Zeit gekoppelt, nicht an die Bildrate: auf langsamen Rechnern hängt die Kamera nicht nach
  var dt=lastT?clamp(now-lastT,1,250):16.667; lastT=now;
  var f60=dt/16.667;
  p+=(target-p)*(1-Math.pow(1-0.085,f60));
  if(Math.abs(target-p)<0.00005) p=target;
  var cam=camAt(p), speed=0;
  if(last) speed=Math.hypot(cam.x-last.x,cam.y-last.y,(cam.z-last.z)*0.6)/f60;
  last=cam; vel+=(speed-vel)*(1-Math.pow(1-0.35,f60));
  if(!lite&&vel>1){
    if(dt>40&&dt<250){ slowMs+=dt; if(slowMs>1200){ lite=true; stage.classList.add('h3-lite'); } }
    else if(dt<=28) slowMs=Math.max(0,slowMs-dt);
  }

  world.style.transform='translateZ('+PERSP+'px) rotateZ('+cam.roll+'deg) translate3d('+(-cam.x)+'px,'+(-cam.y)+'px,'+(-cam.z)+'px)';

  // Raum-Ebenen bewegen sich mit derselben Kamera
  var W=vw(), Hh=vh();
  var prog=clamp((900-cam.z)/(900-(zN+2300)),0,1);
  var endMix=seg(p,END0+0.01,0.74);
  var zH=1.05+prog*0.45, hw0=Math.max(W,Hh*AR)*zH, hh0=hw0/AR;
  var hx0=(W-hw0)/2-cam.x*0.06*zH, hy0=(Hh-hh0)/2-(cam.y+40)*0.05*zH+hh0*0.04;
  var zE=1.55, hwE=Math.max(W,Hh*AR)*zE, hhE=hwE/AR, hxE=W*0.5-0.5*hwE, hyE=Hh*0.745-0.775*hhE;
  var em=endMix*endMix*(3-2*endMix);
  var hw=lerp(hw0,hwE,em), hh=lerp(hh0,hhE,em), hx=lerp(hx0,hxE,em), hy=lerp(hy0,hyE,em);
  placePlate(plH,PL_H,hx,hy,hw,hh,(cam.roll*0.6*(1-em)).toFixed(2));
  setS(dim,'opacity',(1-(0.72+Math.min(vel*0.004,0.2))).toFixed(3));
  var zL=1.15+prog*1.1, lw=Math.max(W,Hh*AR)*zL, lh=lw/AR;
  var lx=(W-lw)/2-cam.x*0.16*zL+Math.sin(p*9)*20, ly=(Hh-lh)/2-cam.y*0.12*zL-lh*0.08;
  placePlate(plL,PL_L,lx,ly,lw,lh,cam.roll);
  setS(plL,'opacity',(0.22+Math.min(vel*0.006,0.3)*(1-endMix)).toFixed(3));

  // Panels: Bewegungsunschärfe bei hohem Tempo (begrenzt und in ganzen Pixeln), Video läuft nur, solange es zu sehen ist
  var blur=(reduce||lite)?0:clamp((vel-6)*0.09,0,16);
  for(var i=0;i<N;i++){
    var pn=panels[i], st=panelState(i,p), dist=cam.z-pn.z;
    pn.el.style.transform='translate3d('+pn.x+'px,'+pn.y+'px,'+pn.z+'px) rotateY('+st.ry+'deg) rotateZ('+st.rz+'deg)';
    setS(pn.el,'visibility',dist<350?'hidden':'visible');
    var op=clamp((dist-350)/550,0,1)*(p>END0?1-seg(p,END0,END0+0.03):1);
    setS(pn.el,'opacity',op.toFixed(2));
    var bpx=op>0.02?Math.round(Math.min(8,blur*(1-st.face*0.85))):0;
    setS(pn.el,'filter',bpx>=1?'blur('+bpx+'px) brightness('+(1+bpx*0.03).toFixed(2)+')':'none');
    setPlaying(pn, op>0.02 && dist>=350 && dist<9000);
  }
  setS(floor,'visibility',p<END0?'hidden':'visible');

  // Texte
  setS(intro,'opacity',(1-seg(p,0.012,0.045)).toFixed(3));
  setS(intro,'transform','translateY('+(-seg(p,0.015,0.06)*40).toFixed(1)+'px)');
  setS(hint,'opacity',(1-seg(p,0,0.02)).toFixed(3));
  var capI=-1, capA=0;
  for(var j=0;j<N;j++){ var b0=T0+j*B, tEnd=b0+TR, hEnd=b0+B; if(p>=tEnd&&p<hEnd){ capI=j; capA=Math.min(seg(p,tEnd,tEnd+0.02),1-seg(p,hEnd-0.02,hEnd)); } }
  if(capI!==lastCap&&capI>=0){ capT.textContent=panels[capI].name; capN.textContent=('0'+(capI+1)).slice(-2)+' / 0'+N; lastCap=capI; }
  setS(cap,'opacity',capA.toFixed(3));
  var fA=seg(p,0.945,0.99);
  setS(fin,'opacity',fA.toFixed(3));
  setS(fin,'transform','translateY(calc(-50% + '+((1-fA)*24).toFixed(1)+'px))');
  fin.classList.toggle('on',fA>0.5);

  // N-Landung als Einzelbilder, Fall und Aufprall bekommen die halbe Scrollstrecke
  var vA=seg(p,V0-0.012,V0);
  setS(nv,'opacity',vA.toFixed(3));
  if(vA>0&&FRAME_COUNT){
    if(!framesStarted) loadFrames();
    var tv=seg(p,V0,V1), NL=FRAME_COUNT-1;
    var want=Math.round(tv<0.5?11+(tv/0.5)*15:26+((tv-0.5)/0.5)*(NL-26));
    var fi=frameNear(want);
    if(fi>=0&&fi!==lastFi){ lastFi=fi; var im=NIMG[fi];
      var Wc=nv.width, Hc=nv.height, sc=Math.max(Wc/im.naturalWidth,Hc/im.naturalHeight), w2=im.naturalWidth*sc, h2=im.naturalHeight*sc;
      nctx.drawImage(im,(Wc-w2)/2,(Hc-h2)/2,w2,h2); }
  }
  drawBG(cam,vel);
  if(Math.abs(target-p)>0.00005||vel>0.05) requestAnimationFrame(frame); else { running=false; lastT=0; }
}

// Partikel gebündelt: wenige Striche je Helligkeit und Stärke statt einem Strich pro Partikel
var NB_A=6, NB_W=3, A_MAX=0.55, W_MAX=1.8, buckets=[];
for(var bi=0;bi<NB_A*NB_W;bi++) buckets.push([]);
function drawBG(cam,v){
  var W=bg.width, H=bg.height; bctx.clearRect(0,0,W,H);
  var cx=W/2, cy=H/2, streak=reduce?0:clamp(v*0.9,0,260)*BDPR;
  for(var b=0;b<buckets.length;b++) buckets[b].length=0;
  for(var i=0;i<P.length;i++){
    var q=P[i], depth=0.15+q.z*0.85;
    var zz=((q.z-cam.z*0.00012)%1+1)%1+0.08;
    var sx=cx+(q.x*W*0.7-cam.x*0.25*depth)/zz*0.35, sy=cy+(q.y*H*0.7-cam.y*0.25*depth)/zz*0.35;
    if(sx<-50||sx>W+50||sy<-50||sy>H+50) continue;
    var a=(0.12+0.5*(1-zz))*(0.6+q.s*0.4), dx=sx-cx, dy=sy-cy, len=Math.hypot(dx,dy)||1, L=streak*(1.2-zz)*0.8;
    var alpha=a*(L>2?0.9:0.7), lw=(1.2-zz)*1.6;
    var ai=Math.min(NB_A-1,Math.floor(alpha/A_MAX*NB_A)), wi=Math.min(NB_W-1,Math.max(0,Math.floor(lw/W_MAX*NB_W)));
    buckets[ai*NB_W+wi].push(sx,sy,sx+dx/len*L,sy+dy/len*L);
  }
  bctx.lineCap='round';
  for(var x=0;x<NB_A;x++) for(var y=0;y<NB_W;y++){
    var arr=buckets[x*NB_W+y]; if(!arr.length) continue;
    bctx.strokeStyle='rgba(212,180,122,'+((x+0.5)/NB_A*A_MAX).toFixed(3)+')';
    bctx.lineWidth=(y+0.5)/NB_W*W_MAX*BDPR;
    bctx.beginPath();
    for(var j=0;j<arr.length;j+=4){ bctx.moveTo(arr[j],arr[j+1]); bctx.lineTo(arr[j+2],arr[j+3]); }
    bctx.stroke();
  }
}

/* ---------- Anhalten an jedem Video (nur beim Runterscrollen) ---------- */
var HOLD_MS=500, HOLD_MAX_MS=4500, SWALLOW_MS=900;
var lock=null, lockTimer=null, swallowTimer=null, blocking=false;
var lastInput=0, prevTarget=0, swallow=false, releasedAt=0, lastWheelT=0, lastWheelAbs=0, touchY=null, jumpUntil=0;
function holdStart(i){ return T0+i*B+TR; }
function holdCenter(i){ return T0+i*B+TR+(B-TR)*0.5; }
function progToY(pr){ var r=hero.getBoundingClientRect(); return Math.round(r.top+scrollY+pr*(hero.offsetHeight-innerHeight)); }
function pinTo(y){ if(Math.abs(scrollY-y)>1) window.scrollTo({top:y,behavior:'instant'}); }

function addBlockers(){ if(blocking) return; blocking=true;
  addEventListener('wheel',blockWheel,{passive:false});
  addEventListener('touchmove',blockTouch,{passive:false});
}
function removeBlockers(){ if(!blocking) return; blocking=false;
  removeEventListener('wheel',blockWheel,{passive:false});
  removeEventListener('touchmove',blockTouch,{passive:false});
}
function engage(i){
  var hc=holdCenter(i), y=progToY(hc);
  lock={i:i,y:y,t0:performance.now(),arrived:0};
  target=hc; prevTarget=hc; swallow=false; clearTimeout(swallowTimer);
  var v=panels[i].vid; if(v){ try{ v.currentTime=0; }catch(e){} }   // die Szene beginnt von vorn, wenn man ankommt
  loadFrames();   // Einzelbilder der N-Landung erst jetzt holen: die Seite steht gerade, ein Aussetzer fällt nicht auf
  addBlockers();
  pinTo(y);
  clearInterval(lockTimer); lockTimer=setInterval(checkLock,60);
  kick();
}
function checkLock(){
  if(!lock){ clearInterval(lockTimer); lockTimer=null; return; }
  var now=performance.now();
  if(!lock.arrived && p>=holdStart(lock.i)-0.004) lock.arrived=now;   // Panel steht frontal im Bild
  if((lock.arrived && now-lock.arrived>=HOLD_MS) || now-lock.t0>=HOLD_MAX_MS) release(true);
}
function endSwallow(){ swallow=false; clearTimeout(swallowTimer); if(!lock) removeBlockers(); }
function release(timed){
  if(!lock) return;
  lock=null; clearInterval(lockTimer); lockTimer=null;
  prevTarget=calcTarget();
  if(timed){
    // Nachlauf eines Trackpads aus der Zeit vor dem Halt soll nicht direkt zum nächsten Video schieben
    swallow=true; releasedAt=performance.now();
    clearTimeout(swallowTimer); swallowTimer=setTimeout(endSwallow,SWALLOW_MS);
  } else endSwallow();
}
function blockWheel(e){
  var now=performance.now(), a=Math.abs(e.deltaY);
  if(lock){
    if(e.deltaY<0) release(false);          // nach oben: frei
    else e.preventDefault();
    lastWheelT=now; lastWheelAbs=a; return;
  }
  if(swallow){
    var decaying=a<=lastWheelAbs*0.97;
    if(e.deltaY>0 && now-lastWheelT<140 && decaying && now-releasedAt<SWALLOW_MS){ e.preventDefault(); lastWheelT=now; lastWheelAbs=a; return; }
    endSwallow();
  }
  lastWheelT=now; lastWheelAbs=a;
}
function blockTouch(e){
  if(!lock) return;
  var y=e.touches[0]?e.touches[0].clientY:null;
  if(touchY!==null && y!==null && y-touchY>8){ release(false); return; }   // Finger nach unten = Seite nach oben
  e.preventDefault();
}
function trackWheel(){ lastInput=performance.now(); }
function trackTouch(e){ lastInput=performance.now(); if(e.type==='touchstart') touchY=e.touches[0]?e.touches[0].clientY:null; }
var DOWN_KEYS={ArrowDown:1,PageDown:1,' ':1,Spacebar:1}, UP_KEYS={ArrowUp:1,PageUp:1,Home:1};
function onKey(e){
  if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey) return;
  var t=e.target, k=e.key;
  if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if((k===' '||k==='Spacebar')&&t&&/^(A|BUTTON|SUMMARY)$/.test(t.tagName)) return;   // Leertaste auf Knöpfen bleibt ein Klick
  if(DOWN_KEYS[k]||UP_KEYS[k]||k==='End') lastInput=performance.now();
  if(k==='End'||k==='Home') jumpUntil=performance.now()+1500;   // gewollter Sprung ans Ende oder an den Anfang
  if(!lock) return;
  if(DOWN_KEYS[k]) e.preventDefault();
  else if(UP_KEYS[k]||k==='End') release(false);
}
function onLinkClick(e){
  var a=e.target&&e.target.closest?e.target.closest('a[href^="#"]'):null;
  if(!a) return;
  lastInput=0;                    // Sprung über einen Link ist kein Scrollen, dort wird nicht angehalten
  if(lock) release(false); endSwallow();
}

function onScroll(){
  if(lock){ pinTo(lock.y); return; }
  var nt=calcTarget(), now=performance.now();
  // auch ein harter Wurf, der in einem Schritt über alle Videos hinausgeht, hält beim ersten übersprungenen
  if(nt>prevTarget && now-lastInput<450 && now>jumpUntil){
    for(var i=0;i<N;i++){ var hs=holdStart(i); if(prevTarget<hs && nt>=hs){ engage(i); return; } }
  }
  prevTarget=nt; target=nt;
  if(!framesStarted&&target>=holdStart(0)) loadFrames();   // z. B. nach einem Sprung per Link
  kick();
}

new IntersectionObserver(function(en){
  onScreen=en[0].isIntersecting;
  if(onScreen) kick(); else panels.forEach(function(pn){ setPlaying(pn,false); });
},{threshold:0}).observe(hero);

window.NitorHero={
  start:function(){
    if(active) return; active=true;
    size();
    panels.forEach(function(pn){ if(pn.vid&&pn.vid.preload!=='auto'){ pn.vid.preload='auto'; pn.vid.load(); } });
    addEventListener('scroll',onScroll,{passive:true});
    addEventListener('resize',onResize);
    addEventListener('wheel',trackWheel,{passive:true});
    addEventListener('touchstart',trackTouch,{passive:true});
    addEventListener('touchmove',trackTouch,{passive:true});
    addEventListener('keydown',onKey);
    document.addEventListener('click',onLinkClick,true);
    target=calcTarget(); p=target; prevTarget=target;
    if(target>=holdStart(0)) loadFrames();
    kick();
  },
  stop:function(){
    if(!active) return; active=false;
    if(lock) release(false); endSwallow();
    removeEventListener('scroll',onScroll);
    removeEventListener('resize',onResize);
    removeEventListener('wheel',trackWheel,{passive:true});
    removeEventListener('touchstart',trackTouch,{passive:true});
    removeEventListener('touchmove',trackTouch,{passive:true});
    removeEventListener('keydown',onKey);
    document.removeEventListener('click',onLinkClick,true);
    panels.forEach(function(pn){ setPlaying(pn,false); });
  }
};
})();
