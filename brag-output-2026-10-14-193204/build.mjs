import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import bodies from '../frontend/src/lib/body-paths.js';
const base=new URL('./',import.meta.url),out=new URL('composition/',base);
const config=JSON.parse(await readFile(new URL('narration.json',base),'utf8'));
const voice=JSON.parse(await readFile(new URL('narration-meta.json',base),'utf8'));
const measuredChapters=voice.chapters;
const audioData=JSON.parse(await readFile(new URL('assets/music/audio-data.json',out),'utf8'));
if(audioData.frames.length<5400)throw new Error('Music analysis must cover all 180 seconds.');
const lightFrames=audioData.frames.slice(0,5400).map((f,i,a)=>Number((a.slice(Math.max(0,i-4),i+1).reduce((s,x)=>s+x.bands[0],0)/Math.min(5,i+1)).toFixed(4)));
if(voice.lines.length!==82)throw new Error('The full 82-phrase narrative is required.');
await mkdir(new URL('compositions/',out),{recursive:true});
await mkdir(new URL('assets/runtime/',out),{recursive:true});
await cp(new URL('../frontend/public/brand-logo.png',base),new URL('assets/brand-logo.png',out));
await cp(new URL('../frontend/public/brand-logo.png',base),new URL('assets/brand-logo-end.png',out));
await cp(new URL('../brag-output/one-minute/composition/assets/runtime/gsap.min.js',base),new URL('assets/runtime/gsap.min.js',out));
for(const slug of ['bench-press','squat','deadlift'])await cp(new URL(`../frontend/src/assets/exercise-sprites/${slug}/`,base),new URL(`assets/sprites/${slug}/`,out),{recursive:true});
await cp(new URL('../frontend/src/assets/exercise-sprites/bench-press/',base),new URL('assets/sprites/bench-press-sets/',out),{recursive:true});
const esc=t=>String(t).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const typed=(text,at=.8)=>`<span class="typed" data-type="${esc(text)}" data-at="${at}"><span>${esc(text)}</span><i></i></span>`;
const bit=(html,kind='row')=>`<div class="piece ${kind}">${html}</div>`;
const pane=(id,start,end,html,kind='')=>`<article id="${id}" class="pane ${kind}" data-pane-start="${start}" data-pane-end="${end}">${html}</article>`;
const panel=html=>`<div class="panel">${html}</div>`;
const button=text=>`<div class="action piece">${text}<span class="play">▶</span></div>`;
const week=(active=1)=>`<div class="week">${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((d,i)=>`<div class="piece day ${i===active?'selected':''}"><span>${d}</span><b>${12+i}</b><i></i></div>`).join('')}</div>`;
const sprite=(slug,label)=>`<div class="sprite" data-sprite="${slug}" aria-label="${label}">${[1,2,3,4].map((i)=>`<img src="assets/sprites/${slug}/frame-${i}.webp" class="sprite-frame ${i===1?'first':''}" alt="${label}">`).join('')}</div>`;
const loads={chest:18,'upper-back':17,deltoids:14,biceps:9,triceps:11,abs:10,obliques:7,gluteal:16,quadriceps:19,hamstring:14,calves:8};
const fatigue={chest:.68,'upper-back':.28,deltoids:.55,biceps:.22,triceps:.62,abs:.18,obliques:.12,gluteal:.34,quadriceps:.47,hamstring:.3,calves:.08};
const inert=new Set(['head','hair','neck','hands','feet','knees','ankles']);
function anatomy(mode='balance',view='front') {
 const data=bodies.male[view];
 const palette=mode==='fatigue'?['#536768','#77915f','#e3c544','#f7a24b','#ef6f62']:['#536768','#2f7475','#279597','#38b5b6','#63e6e2'];
 const paths=Object.entries(data.p).flatMap(([slug,segments])=>segments.map(d=>{
  const v=(mode==='fatigue'?fatigue:loads)[slug]||0;
  const level=mode==='fatigue'?(v>.55?4:v>=.4?3:v>=.25?2:v>=.15?1:0):(v?Math.max(1,Math.min(4,Math.ceil(v/19*4))):0);
  const color=mode==='measure'?(slug==='obliques'?'#63e6e2':'#536768'):palette[level];
  return `<path data-muscle="${slug}" d="${d}" fill="${inert.has(slug)?'#718687':color}"/>`;
 })).join('');
 const ring=mode==='measure'?'<ellipse class="waist-guide" cx="363.5" cy="543" rx="107.596" ry="11.52" fill="none" stroke="#b5fffa" stroke-width="7"/>':'';
 return `<svg class="body-map piece" viewBox="${data.vb}" aria-label="BodyMap ${view}">${paths}${ring}</svg>`;
}
const pair=mode=>`<div class="body-pair">${anatomy(mode,'front')}${anatomy(mode,'back')}</div>`;
const tabs=(items,selected=0)=>`<div class="tabs">${items.map((x,i)=>`<div class="piece ${i===selected?'selected':''}">${x}</div>`).join('')}</div>`;
const chart=(values,min,max)=>{
 const pts=values.map((v,i)=>`${78+i*640/(values.length-1)},${95+(max-v)/(max-min)*330}`);
 return `<svg class="chart piece" viewBox="0 0 800 530" aria-label="Gráfico de registros demonstrativos"><g stroke="#425a5b" stroke-width="2">${[100,210,320,430].map(y=>`<line x1="65" y1="${y}" x2="748" y2="${y}"/>`).join('')}</g><polyline class="draw-path" points="${pts.join(' ')}" fill="none" stroke="#63e6e2" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>${pts.map(p=>{const [x,y]=p.split(',');return `<circle class="chart-dot" cx="${x}" cy="${y}" r="7" fill="#63e6e2"/>`;}).join('')}<g fill="#b5c4c4" font-size="36"><text x="65" y="500">Antes</text><text x="748" y="500" text-anchor="end">Agora</text></g></svg>`;
};
const scenes={
intro:[
 pane('intro-brand',0,6.2,`<img class="logo piece" src="assets/brand-logo.png" alt="Fit Pro Player">`, 'brand-pane'),
 pane('intro-journey',6.2,12,panel(`${bit('<strong>Plano semanal</strong><span>Prepare a sessão</span>')}${bit('<strong>Treino guiado</strong><span>Execute e registre</span>')}${bit('<strong>Histórico</strong><span>Acompanhe a rotina</span>')}`))
],
plan:[
 pane('plan-week',0,8.2,panel(`${bit('<h3>Plano semanal</h3>','heading')}${week()}${bit('<strong>Dia de Peito</strong><span>6 exercícios</span>','routine')}${button('Começar')}`)),
 pane('plan-edit',8.2,18,panel(`${bit('<h3>Editar exercício</h3>','heading')}${bit(`<small>Exercício</small><strong>${typed('Supino com barra',.65)}</strong>`,'field')}${bit('<div class="three"><span>Séries<b>3</b></span><span>Carga<b>60 kg</b></span><span>Reps<b>10</b></span></div>')}${bit(`<small>Observações</small><div class="note-input">${typed('Controlar a descida',4.1)}</div>`,'field')}${button('Salvar')}`)),
 pane('plan-ready',18,24,panel(`${bit('<h3>Dia de Peito</h3>','heading')}${bit('<strong>Supino com barra</strong><span>3 séries · 10 repetições</span>')}${bit('<strong>Crucifixo</strong><span>3 séries · 12 repetições</span>')}${bit('<strong>Tríceps</strong><span>3 séries · 12 repetições</span>')}${button('Começar')}`))
],
workout:[
 pane('workout-move',0,7.3,panel(`${bit('<h3>Supino com barra</h3>','heading')}${sprite('bench-press','Supino com barra')}${bit('<span>Peitoral · barra</span>','center')}`)),
 pane('workout-sets',7.3,19.5,panel(`${bit('<h3>Supino com barra</h3>','heading')}${sprite('bench-press-sets','Supino com barra')}<div class="sets">${bit('<span>Série</span><span>kg</span><span>Reps</span><span></span>','set-head')}${[1,2,3].map((n)=>bit(`<b>${n}</b><span>${typed(n===1?'60':'62,5',.5+n*.16)}</span><span>${typed(n===3?'8':'10',.8+n*.16)}</span><span class="set-state ${n===1?'demo-set':''}">${n===1?'▶':'—'}</span>`,'set-row')).join('')}</div><div class="rest piece"><span>Descanso</span><strong class="rest-count">01:30</strong></div>`)),
 pane('workout-adjust',19.5,30,panel(`${bit('<h3>Ajustes do exercício</h3>','heading')}${bit('<small>Última vez</small><strong>60 kg × 10 · 60 kg × 10</strong>')}${bit('<strong>Adicionar série</strong><span>Ajuste a sessão</span>')}${bit('<strong>Aquecimento</strong><span>Prepare a execução</span>')}${bit('<strong>Substituir exercício</strong><span>Consulte outra opção</span>')}${bit('<strong>Esforço por série</strong><span>Opcional · RIR ou RPE</span>')}`))
],
library:[
 pane('library-bench',0,6.2,panel(`${bit('<h3>Supino com barra</h3>','heading')}${sprite('bench-press','Supino com barra')}${bit('<strong>Músculos trabalhados</strong><span>Peitoral · tríceps · deltoides</span>')}`)),
 pane('library-squat',6.2,12.6,panel(`${bit('<h3>Agachamento</h3>','heading')}${sprite('squat','Agachamento completo com barra')}${bit('<strong>Músculos trabalhados</strong><span>Quadríceps · glúteos</span>')}`)),
 pane('library-deadlift',12.6,20,panel(`${bit('<h3>Levantamento terra</h3>','heading')}${sprite('deadlift','Levantamento terra com barra')}${bit('<strong>Músculos trabalhados</strong><span>Posterior de coxa · glúteos</span>')}`))
],
body:[
 pane('body-balance',0,9.3,`${tabs(['Equilíbrio','Fadiga','Força'])}${pair('balance')}${panel(bit('<strong>Distribuição das séries</strong><span>Selecione uma região</span>'))}`,'anatomy-pane'),
 pane('body-fatigue',9.3,17.2,`${tabs(['Equilíbrio','Fadiga','Força'],1)}${pair('fatigue')}${panel(bit('<strong>Recuperação estimada</strong><span>Histórico do treino</span>'))}`,'anatomy-pane'),
 pane('body-strength',17.2,25,`${tabs(['Equilíbrio','Fadiga','Força'],2)}${pair('balance')}${panel(bit('<strong>Força estimada</strong><span>Exercícios e registros</span>'))}`,'anatomy-pane')
],
progress:[
 pane('progress-history',0,9.8,panel(`${bit('<h3>Histórico</h3>','heading')}${bit('<strong>Dia de Peito</strong><span>Sessão concluída</span>','routine')}${bit('<strong>Supino com barra</strong><span>60 kg × 10 · 62,5 kg × 10 · 62,5 kg × 8</span>')}${bit('<strong>Séries registradas</strong><span>Consulte os exercícios</span>')}${button('Ver detalhes')}`)),
 pane('progress-weight',9.8,24,panel(`${bit('<h3>Peso corporal</h3><small>Visão mensal</small>','heading')}${bit(`<div class="hero-value">${typed('79,8',.7)}<small> kg</small></div>`,'value-piece')}${chart([82.4,82.1,81.9,81.6,81.3,80.9,80.7,80.3,79.8],79.5,83)}${bit('<strong>Histórico de registros</strong><span>Consulte diferentes períodos</span>')}`))
],
measures:[
 pane('measure-input',0,8.1,`<div class="measurement-pair">${anatomy('measure','front')}<div class="measure-fields">${panel(`${bit('<h3>Cintura</h3>','heading')}${bit(`<small>Circunferência</small><strong>${typed('89',2)} cm</strong>`,'field')}${button('Salvar medida')}`)}</div></div>${panel(bit('<strong>Guia da fita métrica</strong><span>Selecione a região no corpo</span>'))}`,'anatomy-pane'),
 pane('measure-compare',8.1,16,panel(`${bit('<h3>Comparação corporal</h3>','heading')}${bit('<small>Região</small><strong>Cintura</strong>')}${bit('<div class="compare"><div><small>31 ago</small><strong>91 cm</strong></div><span>→</span><div><small>7 set</small><strong>89 cm</strong></div></div>')}${chart([91,90.4,89.8,89],88,92)}${bit('<span>Check-ins e medições registradas</span>')}`))
],
professional:[
 pane('professional-edit',0,10.8,panel(`${bit('<h3>Novo programa</h3>','heading')}${bit(`<small>Nome do programa</small><strong>${typed('Treino de força',.9)}</strong>`,'field')}${week(0)}${bit('<strong>Montar semana</strong><span>Exercícios · séries · descanso</span>')}${button('Publicar nova versão')}`)),
 pane('professional-follow',10.8,20,panel(`${bit('<h3>Programa atual</h3>','heading')}${bit('<strong>Treino de força</strong><span>Versão 1 · prescrição publicada</span>','routine')}${button('Enviar para aluno')}${bit('<strong>Próximo treino</strong><span>Acessar a sessão recebida</span>')}${bit('<strong>Atividade recente</strong><span>Consulte as execuções</span>')}${bit('<strong>Alunos que precisam de atenção</strong><span>Acompanhe as pendências</span>')}`))
],
outro:[
 pane('outro-flow',0,4.4,panel(`${bit('<strong>Plano semanal</strong><span>Preparar</span>')}${bit('<strong>Treino guiado</strong><span>Executar e registrar</span>')}${bit('<strong>Evolução</strong><span>Rever e acompanhar</span>')}`)),
 pane('outro-brand',4.4,9,`<img class="logo piece closing-logo" src="assets/brand-logo-end.png" alt="Fit Pro Player"><div class="address piece">fitpp.com.br</div>`,'brand-pane')
]
};
const css=`
:root{--bg:#030909;--surface:#101b1d;--acc:#0F8B8D;--bright:#63e6e2;--text:#ffffff;--muted:#b5c4c4}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:var(--bg);color:var(--text);font-family:system-ui,sans-serif}#root{position:relative;width:100%;height:100%;overflow:hidden}.host{position:absolute;inset:0}.ground{position:absolute;inset:0;background:#030909}.light{position:absolute;inset:0;background:radial-gradient(ellipse at 60% 45%,#0F8B8D64 0%,#0F8B8D15 48%,transparent 78%)}
.world{position:absolute;inset:0;display:flex;flex-direction:column;padding:210px 108px 290px;perspective:1800px}.scene-title{font-size:78px;line-height:1.1;font-weight:650;letter-spacing:-2.5px;width:864px;margin:0;min-height:172px}.title-word{display:inline-block;margin-right:17px}.stage{position:relative;width:864px;height:1070px;margin-top:44px}.pane{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:26px;opacity:0}.pane:first-child{opacity:1}.panel{background:var(--surface);border:2px solid #426465;border-radius:34px;padding:44px;box-shadow:0 32px 85px #000a;overflow:hidden;width:100%;--hf-panel-open:1;clip-path:inset(0 0 calc((1 - var(--hf-panel-open))*100%) 0 round 34px)}
.piece{position:relative}.row{padding:27px 0;border-bottom:2px solid #334849;display:flex;flex-direction:column;gap:13px}.row:last-child{border-bottom:0}.row strong,.field strong{font-size:49px;font-weight:600;line-height:1.2;display:block}.row span{font-size:36px;color:var(--muted);line-height:1.35}.heading{margin-bottom:24px}h3{margin:0;font-size:59px;line-height:1.15;font-weight:650;letter-spacing:-1.5px}small{font-size:34px;color:var(--muted);display:block;line-height:1.3}.field{padding:25px 0}.field strong{margin-top:16px}.typed{display:inline-flex;align-items:center;position:relative;max-width:100%;min-height:1.25em}.typed>span{white-space:nowrap;display:block;overflow:hidden;max-width:100%}.typed i{display:inline-block;width:3px;height:.9em;margin-left:5px;background:var(--bright);opacity:0}
.routine{padding:33px;background:#183537;border-radius:22px;border:2px solid #377174;margin:22px 0;display:flex;flex-direction:column;gap:13px}.routine strong{font-size:49px;line-height:1.2;font-weight:600;display:block}.routine span{font-size:36px;line-height:1.35;color:var(--muted);display:block}.action{display:flex;justify-content:space-between;align-items:center;font-size:44px;font-weight:600;border-radius:22px;padding:29px 32px;background:#0F8B8D;margin-top:30px}.play{font-size:37px}.week{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin:42px 0}.day{display:flex;flex-direction:column;align-items:center;gap:16px;font-size:29px;color:var(--muted)}.day b{font-size:38px;color:white}.day i{display:block;width:11px;height:11px;background:#688788;border-radius:50%}.selected{background:#0F8B8D!important;color:white!important;border-radius:17px}.day.selected{padding:13px 0}.day.selected i{background:white}.three{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.three span{font-size:34px;color:var(--muted)}.three b{font-size:47px;display:block;color:white;margin-top:18px}.note-input{padding:26px 20px;background:#183537;border:2px solid #426465;border-radius:18px;font-size:40px;margin-top:14px}
.sprite{position:relative;width:100%;height:490px;margin:26px 0}#workout-sets .sprite{height:340px;margin:18px 0}.sprite-frame{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0}.sprite-frame.first{opacity:1}.center{text-align:center}.sets{margin-top:12px}.set-row,.set-head{display:grid;grid-template-columns:75px 1.35fr 1fr 60px;gap:12px;align-items:center;border-bottom:2px solid #334849;padding:20px 0;font-size:45px}.set-row b{font-size:39px;color:var(--muted)}.set-head{font-size:29px;color:var(--muted)}.set-state{font-size:32px;display:flex;align-items:center;justify-content:center;width:51px;height:51px;background:#0F8B8D;border-radius:13px}.rest{display:flex;justify-content:space-between;align-items:center;padding:23px 26px;background:#183537;border-radius:20px;margin-top:25px;font-size:34px}.rest strong{font-size:44px}
.body-pair{display:flex;justify-content:center;gap:26px;width:100%;height:690px}.body-map{width:100%;height:100%;display:block;filter:drop-shadow(0 12px 25px #0F8B8D30)}.body-pair .body-map{width:370px}.tabs{display:flex;gap:8px;background:#14282a;border-radius:22px;padding:9px}.tabs>div{flex:1;padding:25px 12px;text-align:center;font-size:34px;color:var(--muted)}.anatomy-pane>.panel{padding:18px 35px}.anatomy-pane .row strong{font-size:43px}.anatomy-pane .row span{font-size:33px}.hero-value{display:flex;align-items:baseline;font-size:98px;letter-spacing:-3px}.hero-value small{margin-left:22px;font-size:46px}.value-piece{margin:35px 0}.chart{width:100%;height:450px;display:block;margin:25px 0}.chart-dot{opacity:0}.compare{display:flex;justify-content:space-between;align-items:center;font-size:45px}.compare strong{font-size:54px;display:block}.compare>span{color:var(--bright);font-size:54px}.measurement-pair{height:720px;display:grid;grid-template-columns:350px 1fr;gap:22px;align-items:center}.measure-fields .panel{padding:25px}.measure-fields h3{font-size:51px}.measure-fields .action{font-size:31px;padding:22px}.measure-fields .field strong{font-size:52px}.measure-fields .play{font-size:23px}
#measure-compare .chart{height:400px}.brand-pane{justify-content:center;align-items:center;gap:38px}.logo{width:850px;height:850px;object-fit:contain;filter:drop-shadow(0 25px 36px #0009)}.closing-logo{width:750px;height:750px}.address{font-size:64px;font-weight:600;color:var(--bright)}.caption-host{z-index:100;pointer-events:none}.caption{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;padding:0 108px 210px}.caption-box{width:864px;padding:18px 22px;border:2px solid #4d6e6f;border-radius:18px;background:#030909ed;text-align:center;box-shadow:0 8px 25px #0008}.caption-line{font-size:52px;line-height:1.2;font-weight:550;margin:0;color:white;white-space:nowrap;max-width:816px}
`;
await writeFile(new URL('style.css',out),css);
const wordTitle=text=>text.split(' ').map(w=>`<span class="title-word">${esc(w)}</span>`).join('');
for(const chapter of measuredChapters){
 const id=`scene-${chapter.id}`,duration=chapter.end-chapter.start;
 const planned=config.chapters.find(c=>c.id===chapter.id);
 const ratio=duration/(planned.end-planned.start);
 const content=scenes[chapter.id].join('').replace(/data-pane-(start|end)="([\d.]+)"/g,(_,k,v)=>`data-pane-${k}="${Number(v)*ratio}"`);
 const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body><template><style>#${id}{position:absolute;inset:0;width:100%;height:100%;overflow:hidden}</style><div id="${id}" data-composition-id="${id}" data-width="1080" data-height="1920" data-duration="${duration}"><div id="${id}-world" class="world"><h2 class="scene-title">${wordTitle(chapter.title)}</h2><div class="stage">${content}</div></div></div><script>(function(){
 const root=document.getElementById('${id}');const tl=gsap.timeline({paused:true});
 const world=root.querySelector('.world');
 tl.fromTo(world,{x:120,scale:1.075},{x:0,scale:1,duration:.46,ease:'power3.out'},0);
 tl.fromTo(root.querySelectorAll('.title-word'),{y:28,opacity:0},{y:0,opacity:1,duration:.3,stagger:.055,ease:'power3.out'},.05);
 for(const p of root.querySelectorAll('.pane')){
  const start=Number(p.dataset.paneStart),end=Number(p.dataset.paneEnd);
  tl.fromTo(p,{opacity:0},{opacity:1,duration:.01,immediateRender:false,ease:'none'},start);
  tl.fromTo(p,{x:160,scale:1.04},{x:0,scale:1,duration:.42,ease:'power3.out',immediateRender:false},start);
  const pieces=p.querySelectorAll('.piece');
  pieces.forEach((el,i)=>tl.fromTo(el,{y:34,x:i%2?-18:18,opacity:0},{y:0,x:0,opacity:1,duration:.36,ease:i%3===0?'power4.out':i%3===1?'power2.out':'sine.out',immediateRender:false},start+.05+i*.055));
  for(const box of p.querySelectorAll('.panel'))tl.fromTo(box,{'--hf-panel-open':0},{'--hf-panel-open':1,duration:.44,ease:'power3.out',immediateRender:false},start);
  for(const t of p.querySelectorAll('.typed')){
   const text=t.dataset.type,span=t.querySelector('span'),caret=t.querySelector('i');
   const at=start+Number(t.dataset.at||.7);tl.set(span,{innerText:''},0);
   for(let k=1;k<=text.length;k++)tl.set(span,{innerText:text.slice(0,k)},at+k*(text.length>18?.075:.095)+(k>7?.07:0));
   tl.set(caret,{opacity:1},at);tl.to(caret,{opacity:.1,duration:.25,repeat:Math.max(0,Math.floor((text.length*.09)/.25)-1),yoyo:true,ease:'none'},at+.1);tl.set(caret,{opacity:0},at+text.length*.095+.45);
  }
  for(const s of p.querySelectorAll('.sprite')){
   const frames=s.querySelectorAll('.sprite-frame');for(let k=0;start+k*.6<end;k++){tl.set(frames,{opacity:0},start+k*.6);tl.set(frames[k%4],{opacity:1},start+k*.6);}
  }
  for(const path of p.querySelectorAll('.draw-path')){
   const length=path.getTotalLength();tl.set(path,{strokeDasharray:length,strokeDashoffset:length},0);tl.to(path,{strokeDashoffset:0,duration:4.8,ease:'power2.inOut'},start+.6);
  }
  const dots=p.querySelectorAll('.chart-dot');if(dots.length)tl.fromTo(dots,{opacity:0,scale:.5,transformOrigin:'center'},{opacity:1,scale:1,duration:.2,stagger:.4,ease:'power2.out',immediateRender:false},start+1);
  if(p.querySelector('.demo-set')){const n=p.querySelector('.demo-set');tl.set(n,{innerText:'■'},start+3.5);tl.set(n,{innerText:'✓',backgroundColor:'#276b55'},start+5.8);const timer=p.querySelector('.rest-count');for(let k=0;k<5;k++)tl.set(timer,{innerText:'01:'+String(30-k).padStart(2,'0')},start+6+k);}
  if(end<${duration}){tl.to(p,{x:-175,scale:.96,duration:.28,ease:'power2.in'},end-.28);tl.set(p,{opacity:0},end);}
 }
 // beat-locked: the anatomy focus begins at the music's 86.25s return.
 const focusAt=${chapter.id==='body'?Math.max(.8,86.25-chapter.start):2.6};
 const selected=root.querySelectorAll('[data-muscle="${chapter.id==='measures'?'obliques':'chest'}"]');if(selected.length)tl.to(selected,{fill:'#b5fffa',duration:.8,repeat:2,yoyo:true,ease:'sine.inOut'},focusAt);
 if('${chapter.id}'==='outro')tl.to(root.querySelector('.closing-logo'),{scale:.985,duration:3.5,ease:'none'},4.5);
 if('${chapter.id}'!=='outro')tl.to(world,{x:-100,y:-25,scale:.96,duration:.28,ease:'power2.in'},${duration}-.28);
 window.__timelines['${id}']=tl;
})();</script></template></body></html>`;
 await writeFile(new URL(`compositions/${id}.html`,out),html);
}
const captions=voice.lines.map((c,i)=>`<div id="caption-${i}" class="caption clip" data-start="${c.start}" data-duration="${c.duration}" data-track-kind="captions" data-track-index="90" data-layout-allow-caption-zone><div class="caption-box">${c.lines.map(l=>`<p class="caption-line">${esc(l)}</p>`).join('')}</div></div>`).join('');
await writeFile(new URL('compositions/captions.html',out),`<!doctype html><html lang="pt-BR"><body><template><style>#captions{position:absolute;inset:0;width:100%;height:100%}</style><div id="captions" data-composition-id="captions" data-width="1080" data-height="1920" data-duration="180">${captions}</div><script>(function(){const tl=gsap.timeline({paused:true});window.__timelines['captions']=tl;})();</script></template></body></html>`);
let musicAttrs='';try{const mix=JSON.parse(await readFile(new URL('music-mix.json',base),'utf8'));musicAttrs=Object.entries(mix).map(([k,v])=>`${k}="${esc(v)}"`).join(' ');}catch{}
const hosts=measuredChapters.map((c,i)=>`<div id="scene-${c.id}" class="host clip" data-composition-id="scene-${c.id}" data-composition-src="compositions/scene-${c.id}.html" data-start="${c.start}" data-duration="${c.end-c.start}" data-width="1080" data-height="1920" data-track-kind="graphics" data-track-index="${i+1}"></div>`).join('\n');
const voices=voice.lines.map(c=>`<audio id="vo-${c.id}" data-audio-group="voiceover" src="${c.path}" data-start="${c.start}" data-duration="${c.duration}" data-track-index="60" data-volume="1"></audio>`).join('\n');
await writeFile(new URL('index.html',out),`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=1080,height=1920"><title>Fit Pro Player — do plano à evolução</title><link rel="stylesheet" href="style.css"><script src="assets/runtime/gsap.min.js"></script></head><body><div id="root" data-composition-id="fitpp-3min" data-width="1080" data-height="1920" data-start="0" data-duration="180" data-fps="30"><div id="ground" class="ground" data-layout-ignore></div><div id="light" class="light" data-layout-ignore></div>${hosts}<div id="captions" class="host caption-host clip" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="180" data-width="1080" data-height="1920" data-track-kind="captions" data-track-index="90"></div><audio id="music-bed" data-audio-group="music" src="assets/music/gym-electronic.wav" data-start="0" data-duration="180" data-track-index="50" data-volume="0.25" ${musicAttrs}></audio>${voices}</div><script>const tl=gsap.timeline({paused:true});tl.fromTo('#light',{x:-35,scale:1.03},{x:35,scale:1.1,duration:6,repeat:29,yoyo:true,ease:'sine.inOut'});const light=document.getElementById('light');const lightFrames=${JSON.stringify(lightFrames)};for(let f=0;f<lightFrames.length;f++)tl.call(()=>{light.style.opacity=String(.62+lightFrames[f]*.12);},[],f/30);window.__timelines['fitpp-3min']=tl;</script></body></html>`);
await writeFile(new URL('index.motion.json',out),JSON.stringify({duration:180,assertions:[...measuredChapters.map(c=>({kind:'appearsBy',selector:`#scene-${c.id}-world`,bySec:c.start+.6})),{kind:'appearsBy',selector:'#intro-brand',bySec:1}]},null,2));
await writeFile(new URL('frame.md',out),`---\ncolors:\n  bg: '#030909'\n  panel: '#101b1d'\n  ink: '#ffffff'\n  muted: '#b5c4c4'\n  accent: '#0F8B8D'\n  accentBright: '#63e6e2'\ntypography:\n  family: 'system-ui'\n  headingWeight: 650\n  bodyWeight: 550\n---\n\nMarca e recursos do Fit Pro Player, em superfícies escuras com luz teal. Conteúdo principal dentro do title-safe; legenda em faixa separada. Sem metadados de produção no filme. Componentes demonstrativos baseados no aplicativo, não captura de conta real.\n`);
console.log('BUILD: 180s / 5400 frames, nine modular chapters, 82 measured voice/caption pairs, local brand and exercise assets.');
