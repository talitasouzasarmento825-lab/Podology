// Simulador de Podologia — V2 (recriado)
// Canvas + níveis/casos + sons básicos + texturas procedurais.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---------- Áudio ----------
const Audio = (() => {
  const actx = new (window.AudioContext || window.webkitAudioContext)();
  function click(){ const o=actx.createOscillator(), g=actx.createGain(); o.type='triangle'; o.frequency.value=520; g.gain.setValueAtTime(0.08,actx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+0.08); o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime+0.09); }
  function snip(){ const o=actx.createOscillator(), g=actx.createGain(); o.type='square'; o.frequency.value=280; g.gain.setValueAtTime(0.12,actx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+0.06); o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime+0.07); }
  function sprayStart(){ const bufferSize=2*actx.sampleRate; const noiseBuffer=actx.createBuffer(1,bufferSize,actx.sampleRate); const output=noiseBuffer.getChannelData(0); for(let i=0;i<bufferSize;i++) output[i]=Math.random()*2-1; const whiteNoise=actx.createBufferSource(); whiteNoise.buffer=noiseBuffer; whiteNoise.loop=true; const g=actx.createGain(); g.gain.value=0.05; whiteNoise.connect(g).connect(actx.destination); whiteNoise.start(); return ()=>{ g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime+0.1); whiteNoise.stop(actx.currentTime+0.11); }; }
  function rustle(){ const bufferSize = 2 * 0.1 * actx.sampleRate; const noiseBuffer = actx.createBuffer(1, bufferSize, actx.sampleRate); const output = noiseBuffer.getChannelData(0); for (let i=0;i<bufferSize;i++) output[i]=(Math.random()*2-1)*(1-i/bufferSize); const src=actx.createBufferSource(); src.buffer=noiseBuffer; const g=actx.createGain(); g.gain.value=0.1; src.connect(g).connect(actx.destination); src.start(); }
  function resume(){ if (actx.state==='suspended') actx.resume(); }
  return { click, snip, sprayStart, rustle, resume };
})();

// ---------- Casos ----------
const CASES = [
  { id:'leve', nome:'Leve — inflamação local', hygieneStart:20, infectionStart:25, painStart:15, inflamedRadius:40, bleedingChance:0.08, hasGranuloma:false },
  { id:'moderado', nome:'Moderado — espícula profunda + granuloma', hygieneStart:10, infectionStart:45, painStart:25, inflamedRadius:55, bleedingChance:0.18, hasGranuloma:true },
  { id:'severo', nome:'Severo — bilateral, infecção alta', hygieneStart:5, infectionStart:65, painStart:35, inflamedRadius:60, bleedingChance:0.28, hasGranuloma:true, bilateral:true }
];
const sel = document.getElementById('caseSelect');
CASES.forEach(c=>{ const opt=document.createElement('option'); opt.value=c.id; opt.textContent=c.nome; sel.appendChild(opt); });
let currentCase = CASES[0];
document.getElementById('startCase').addEventListener('click', ()=>{ currentCase = CASES.find(c=>c.id===sel.value)||CASES[0]; startCase(currentCase); Audio.resume(); });

// ---------- Estado ----------
const state = {
  tool:'antiseptic',
  pain:0, infection:0, hygiene:0, precision:0,
  lifted:0, cottonPlaced:false, bandaged:false, cleaned:false,
  time:0, bleeding:0,
  inflamed:{x:640,y:420,r:50}, inflamed2:null,
  toe:{x:640,y:420,w:450,h:260,r:120}, nail:{x:640,y:360,w:420,h:160},
  spiculePath:[], started:false, finished:false, granuloma:false
};

// ---------- UI refs ----------
const painBar=document.getElementById('painBar'), infectionBar=document.getElementById('infectionBar'), hygieneBar=document.getElementById('hygieneBar'), precisionBar=document.getElementById('precisionBar');
const tipBox=document.getElementById('tipBox'), resetBtn=document.getElementById('reset');
const reportOverlay=document.getElementById('reportOverlay'), reportContent=document.getElementById('reportContent');
document.getElementById('closeReport').addEventListener('click',()=>reportOverlay.classList.add('hidden'));
document.getElementById('nextCase').addEventListener('click',()=>{ const idx=CASES.findIndex(c=>c.id===currentCase.id); const next=CASES[(idx+1)%CASES.length]; sel.value=next.id; reportOverlay.classList.add('hidden'); startCase(next); });

// Tools
document.querySelectorAll('.tool').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tool').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); state.tool=btn.dataset.tool; showTipForTool(state.tool); Audio.click();
  });
});
document.querySelector('.tool[data-tool="antiseptic"]').classList.add('active');
resetBtn.addEventListener('click',()=>window.location.reload());

function startCase(conf){
  state.started=true; state.finished=false;
  state.pain=conf.painStart; state.infection=conf.infectionStart; state.hygiene=conf.hygieneStart;
  state.precision=0; state.lifted=0; state.cottonPlaced=false; state.bandaged=false; state.cleaned=false;
  state.time=0; state.bleeding=0; state.spiculePath=[];
  state.inflamed.r=conf.inflamedRadius; state.granuloma=!!conf.hasGranuloma;
  state.inflamed2 = conf.bilateral ? {x: state.inflamed.x - 120, y: state.inflamed.y + 10, r: conf.inflamedRadius*0.9} : null;
  markAllGoals(false); showTip('Inicie higienizando a região com antisséptico.');
}

function markAllGoals(done){ document.querySelectorAll('#goals li').forEach(li=>li.classList.toggle('done',!!done)); }
function markGoal(key){ const li=document.querySelector(`#goals li[data-goal="${key}"]`); if(li) li.classList.add('done'); }

function updateMeters(){ painBar.style.width=clamp(state.pain,0,100)+'%'; infectionBar.style.width=clamp(state.infection,0,100)+'%'; hygieneBar.style.width=clamp(state.hygiene,0,100)+'%'; precisionBar.style.width=clamp(state.precision,0,100)+'%'; }
function clamp(v,a,b){ return Math.min(b,Math.max(a,v)); }
function showTip(t){ tipBox.textContent=t; }
function showTipForTool(tool){
  const tips={ antiseptic:'Aplique o antisséptico na área inflamada até higiene ≥ 80%.', lifter:'Deslize a espátula sob a borda lateral da unha com movimentos curtos.', nipper:'Corte a espícula em linha contínua, evitando tecido vivo.', cotton:'Posicione um rolinho sob a borda elevada.', bandage:'Cubra com curativo sem compressão excessiva.' };
  showTip(tips[tool]||'');
}

// Interação
let mouse={x:0,y:0,down:false}, stopSpray=null;
canvas.addEventListener('mousemove',e=>{ const r=canvas.getBoundingClientRect(); mouse.x=(e.clientX-r.left)*(canvas.width/r.width); mouse.y=(e.clientY-r.top)*(canvas.height/r.height); if(mouse.down) onDrag(); });
canvas.addEventListener('mousedown',e=>{ mouse.down=true; onPress(); });
canvas.addEventListener('mouseup',e=>{ mouse.down=false; onRelease(); });

function onPress(){
  if(!state.started||state.finished) return;
  if(state.tool==='nipper') attemptCut(mouse.x,mouse.y);
  else if(state.tool==='cotton') attemptCotton(mouse.x,mouse.y);
  else if(state.tool==='bandage') attemptBandage(mouse.x,mouse.y);
  else if(state.tool==='antiseptic'){ stopSpray=Audio.sprayStart(); }
}
function onRelease(){ if(stopSpray){ stopSpray(); stopSpray=null; } }
function onDrag(){
  if(!state.started||state.finished) return;
  if(state.tool==='antiseptic'){
    let applied=false;
    [state.inflamed,state.inflamed2].forEach(zone=>{
      if(!zone) return;
      if(inCircle(mouse.x,mouse.y,zone.x,zone.y,zone.r+22)){ applied=true; state.hygiene=clamp(state.hygiene+0.6,0,100); state.infection=clamp(state.infection-0.25,0,100); if(state.hygiene>=80){ state.cleaned=true; markGoal('clean'); } }
    });
    showTip(applied?'Ótimo! Continue higienizando até ≥ 80%.':'Aplique sobre a área inflamada para maior eficácia.');
  } else if(state.tool==='lifter'){
    const nearEdge=(mouse.x>state.nail.x+state.nail.w*0.1 && mouse.x<state.nail.x+state.nail.w*0.6 && mouse.y>state.nail.y+state.nail.h*0.2 && mouse.y<state.nail.y+state.nail.h*0.85);
    if(nearEdge){ const d=(state.hygiene>=80?0.6:0.2); state.lifted=clamp(state.lifted+d,0,100); state.pain=clamp(state.pain+0.08,0,100); if(state.lifted>=70){ markGoal('lift'); showTip('Borda elevada. Siga para o corte da espícula.'); } }
    else{ state.pain=clamp(state.pain+0.2,0,100); showTip('Mantenha a espátula sob a borda lateral.'); }
  }
}

function attemptCut(x,y){
  Audio.snip();
  const onFreeEdge = (y > state.nail.y + state.nail.h*0.2 && y < state.nail.y + state.nail.h*0.9);
  if(!onFreeEdge){ state.pain+=2; showTip('Corte próximo à borda livre, evitando leito ungueal.'); return; }
  if(state.lifted<60){ state.pain+=5; showTip('Eleve mais a borda com a espátula antes de cortar.'); }
  state.spiculePath.push({x,y});
  if(state.spiculePath.length>2){
    const p0=state.spiculePath[0], pN=state.spiculePath[state.spiculePath.length-1];
    let dev=0; for(let i=1;i<state.spiculePath.length-1;i++){ const p=state.spiculePath[i]; dev+=pointLineDistance(p.x,p.y,p0.x,p0.y,pN.x,pN.y); }
    dev/=Math.max(1,(state.spiculePath.length-2));
    const precision=Math.max(0,100-dev);
    state.precision=clamp(state.precision*0.6+precision*0.4,0,100);
  }
  if(state.hygiene<60) state.infection=clamp(state.infection+0.8,0,100);
  if(Math.random()<(getCase().bleedingChance||0.1)) state.bleeding=clamp(state.bleeding+10,0,100);
  state.pain+=(state.lifted>=60?0.8:1.8);
  if(state.precision>=65){ markGoal('cut'); showTip('Corte adequado! Insira um rolinho de algodão.'); }
}

function attemptCotton(x,y){
  if(state.precision<50||state.lifted<50){ state.pain+=2; showTip('Realize um corte preciso e eleve a borda antes do algodão.'); return; }
  const ok=[state.inflamed,state.inflamed2].some(zone=>zone && inCircle(x,y,zone.x+12,zone.y-10,36));
  if(ok){ state.cottonPlaced=true; markGoal('cotton'); showTip('Algodão posicionado. Finalize com curativo.'); }
  else{ state.pain+=0.6; }
}

function attemptBandage(x,y){
  if(!state.cottonPlaced){ showTip('Coloque o algodão antes do curativo.'); state.pain+=0.4; return; }
  if(inCircle(x,y,state.toe.x,state.toe.y,260)){ state.bandaged=true; markGoal('bandage'); showTip('Procedimento concluído!'); finishCase(); Audio.rustle(); }
}

function finishCase(){
  state.finished=true;
  const score=computeScore();
  const html = `
    <p><b>Caso:</b> ${getCase().nome}</p>
    <p><b>Tempo:</b> ${score.time.toFixed(1)} s</p>
    <ul>
      <li>Dor final: ${score.pain.toFixed(0)} / 100</li>
      <li>Infecção final: ${score.infection.toFixed(0)} / 100</li>
      <li>Higiene final: ${score.hygiene.toFixed(0)} / 100</li>
      <li>Precisão de corte: ${score.precision.toFixed(0)} / 100</li>
    </ul>
    <p><b>Avaliação:</b> ${score.rank} — ${score.comment}</p>
  `;
  document.getElementById('reportContent').innerHTML = html;
  document.getElementById('reportOverlay').classList.remove('hidden');
}

function computeScore(){ return { time: state.time, pain: state.pain, infection: state.infection, hygiene: state.hygiene, precision: state.precision, rank: grade(), comment: feedback() }; }
function grade(){ const p=state.pain, i=state.infection, h=state.hygiene, pr=state.precision; let pts=0; if(p<35) pts++; if(i<35) pts++; if(h>=80) pts++; if(pr>=70) pts++; if(state.bleeding<20) pts++; return ['Rever técnica','Regular','Bom','Muito bom','Excelente'][pts] || 'Rever técnica'; }
function feedback(){ const msgs=[]; if(state.hygiene<80) msgs.push('Higiene insuficiente antes do corte.'); if(state.lifted<60) msgs.push('Borda pouco elevada; aumentou a dor.'); if(state.precision<65) msgs.push('Corte impreciso; revise a técnica.'); if(state.infection>50) msgs.push('Infecção elevada; higienize e considere orientação médica.'); if(!msgs.length) return 'Procedimento limpo e preciso; manutenção adequada.'; return msgs.join(' '); }
function getCase(){ return currentCase || CASES[0]; }

// Util
function inCircle(mx,my,cx,cy,r){ const dx=mx-cx, dy=my-cy; return dx*dx+dy*dy<=r*r; }
function pointLineDistance(px,py,x1,y1,x2,y2){ const A=px-x1,B=py-y1,C=x2-x1,D=y2-y1; const dot=A*C+B*D, len_sq=C*C+D*D; let param=-1; if(len_sq!==0) param=dot/len_sq; let xx,yy; if(param<0){xx=x1;yy=y1;} else if(param>1){xx=x2;yy=y2;} else {xx=x1+param*C; yy=y1+param*D;} const dx=px-xx, dy=py-yy; return Math.hypot(dx,dy); }

// Render
function gradientBG(){ const g=ctx.createLinearGradient(0,0,0,canvas.height); g.addColorStop(0,'#0b1016'); g.addColorStop(1,'#131c28'); ctx.fillStyle=g; ctx.fillRect(0,0,canvas.width,canvas.height); }
function roundRect(ctx,x,y,w,h,r){ const rr=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+rr,y); ctx.arcTo(x+w,y,x+w,y+h,rr); ctx.arcTo(x+w,y+h,x,y+h,rr); ctx.arcTo(x,y+h,x,y,rr); ctx.arcTo(x,y,x+w,y,rr); ctx.closePath(); }
function cloud(ctx,x,y,r,n){ ctx.beginPath(); for(let i=0;i<n;i++){ const a=(Math.PI*2/n)*i; ctx.moveTo(x+Math.cos(a)*r, y+Math.sin(a)*r); ctx.arc(x+Math.cos(a)*r, y+Math.sin(a)*r, r*0.7, 0, Math.PI*2); } ctx.fill(); ctx.stroke(); }
function drawSkinTexture(x,y,w,h){ const step=6; ctx.save(); ctx.globalAlpha=0.12; for(let i=x;i<x+w;i+=step){ for(let j=y;j<y+h;j+=step){ const n=(Math.sin(i*0.07)+Math.cos(j*0.09)+Math.sin((i+j)*0.03))*0.33; if(n>0.15){ ctx.fillStyle='#000000'; ctx.fillRect(i,j,1,1); } } } ctx.restore(); }

function drawToe(){
  const {toe,nail,inflamed,inflamed2}=state;
  ctx.save();
  // dedo
  ctx.shadowColor='rgba(0,0,0,0.35)'; ctx.shadowBlur=18;
  ctx.fillStyle='#d8a88a'; roundRect(ctx, toe.x - toe.w/2, toe.y - toe.h/2, toe.w, toe.h, toe.r); ctx.fill(); ctx.shadowBlur=0;
  drawSkinTexture(toe.x - toe.w/2, toe.y - toe.h/2, toe.w, toe.h);
  // rubor pulsante
  [inflamed, inflamed2].forEach((z,idx)=>{ if(!z) return; const pulse=0.6+0.4*Math.sin(performance.now()/500+idx); const grad=ctx.createRadialGradient(z.x,z.y,10,z.x,z.y,z.r+30); grad.addColorStop(0,`rgba(240,60,60,${0.45*pulse})`); grad.addColorStop(1,'rgba(240,60,60,0)'); ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(z.x,z.y,z.r+30,0,Math.PI*2); ctx.fill(); });
  // granuloma
  if(state.granuloma){ ctx.globalAlpha=0.8; ctx.fillStyle='#b22222'; ctx.beginPath(); ctx.arc(inflamed.x-18, inflamed.y-4, 14, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
  // unha
  ctx.fillStyle='#f0eee9'; roundRect(ctx, nail.x - nail.w/2, nail.y - nail.h/2, nail.w, nail.h, 26); ctx.fill();
  const gloss=ctx.createLinearGradient(nail.x-nail.w/2, nail.y-nail.h/2, nail.x+nail.w/2, nail.y+nail.h/2);
  gloss.addColorStop(0,'rgba(255,255,255,0.25)'); gloss.addColorStop(0.6,'rgba(255,255,255,0)'); ctx.fillStyle=gloss; roundRect(ctx, nail.x - nail.w/2, nail.y - nail.h/2, nail.w, nail.h, 26); ctx.fill();
  ctx.fillStyle='#e7e3da'; roundRect(ctx, nail.x - nail.w/2, nail.y + nail.h*0.12, nail.w, nail.h*0.46, 20); ctx.fill();
  // secreção quando infecção alta
  if(state.infection>40){ ctx.save(); ctx.globalAlpha=Math.min(0.5,(state.infection-40)/100); ctx.fillStyle='#9fb34a'; for(let k=0;k<60;k++){ const a=Math.random()*Math.PI*2, r=18+Math.random()*state.inflamed.r; const px=state.inflamed.x+Math.cos(a)*r, py=state.inflamed.y+Math.sin(a)*r; ctx.fillRect(px,py,2,2);} ctx.restore(); }
  // sangue
  if(state.bleeding>0){ ctx.globalAlpha=0.35+Math.min(0.6,state.bleeding/100); ctx.fillStyle='#8b0000'; ctx.beginPath(); ctx.arc(inflamed.x-8,inflamed.y+8, 8+state.bleeding*0.18, 0, Math.PI*2); ctx.fill(); if(inflamed2){ ctx.beginPath(); ctx.arc(inflamed2.x-6,inflamed2.y+6, 6+state.bleeding*0.13, 0, Math.PI*2); ctx.fill(); } ctx.globalAlpha=1; }
  // algodão
  if(state.cottonPlaced){ ctx.fillStyle='#f5f7fb'; ctx.strokeStyle='rgba(0,0,0,0.2)'; cloud(ctx, inflamed.x+14, inflamed.y-14, 18, 6); if(inflamed2) cloud(ctx, inflamed2.x+14, inflamed2.y-12, 16, 6); }
  // curativo
  if(state.bandaged){ ctx.globalAlpha=0.95; ctx.fillStyle='#deb887'; roundRect(ctx, toe.x-230, toe.y-80, 460,160,18); ctx.fill(); ctx.globalAlpha=1; }
  ctx.restore();
}

function drawUIOverlay(){ ctx.save(); ctx.globalAlpha=0.15; ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,30); ctx.restore(); ctx.fillStyle='#bcd2ff'; ctx.font='16px system-ui, sans-serif'; ctx.fillText('Ferramenta: '+state.tool,16,22); ctx.font='14px system-ui, sans-serif'; ctx.fillStyle='#9fb2c9'; ctx.fillText('Siga: Antisséptico → Espátula → Alicate → Algodão → Curativo.', 200,22); }

// Loop
function tick(dt){ state.time+=dt; if(!state.cleaned && state.started) state.infection=clamp(state.infection+dt*3*0.05,0,100); if(state.pain>95||state.infection>95) showTip('Atenção! Dor/Infecção elevadas.'); if(state.bleeding>0 && state.hygiene>=80) state.bleeding=clamp(state.bleeding-dt*3*0.5,0,100); updateMeters(); }
let lastT=performance.now();
function loop(t){ const dt=(t-lastT)/1000; lastT=t; tick(dt); ctx.clearRect(0,0,canvas.width,canvas.height); gradientBG(); drawToe(); drawUIOverlay(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);

// Toque mobile
canvas.addEventListener('touchstart', t=>{ const touch=t.touches[0]; const r=canvas.getBoundingClientRect(); mouse.x=(touch.clientX-r.left)*(canvas.width/r.width); mouse.y=(touch.clientY-r.top)*(canvas.height/r.height); mouse.down=true; onPress(); }, {passive:false});
canvas.addEventListener('touchmove', t=>{ const touch=t.touches[0]; const r=canvas.getBoundingClientRect(); mouse.x=(touch.clientX-r.left)*(canvas.width/r.width); mouse.y=(touch.clientY-r.top)*(canvas.height/r.height); onDrag(); }, {passive:false});
canvas.addEventListener('touchend', t=>{ mouse.down=false; onRelease(); }, {passive:false});
