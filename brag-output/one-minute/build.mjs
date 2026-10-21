import {readFile,writeFile} from 'node:fs/promises';
import bodies from './composition/assets/body-paths.js';
const base=new URL('./',import.meta.url);
const balance={chest:18,'upper-back':17,deltoids:14,biceps:9,triceps:11,abs:10,obliques:7,gluteal:16,quadriceps:19,hamstring:14,calves:8};
const fatigue={chest:.68,'upper-back':.28,deltoids:.55,biceps:.22,triceps:.62,abs:.18,obliques:.12,gluteal:.34,quadriceps:.47,hamstring:.30,calves:.08};
const inert=new Set(['head','hair','neck','hands','feet','knees','ankles']);
function anatomy(mode) {
  const load=mode==='fatigue'?fatigue:balance;
  const palette=mode==='fatigue'?['#37494a','#6f7650','#ffd60a','#ff9f0a','#ff453a']:['#37494a','#266061','#1e7374','#168283','#0F8B8D'];
  return ['front','back'].map(view=>{
    const data=bodies.male[view];
    const paths=Object.entries(data.p).flatMap(([slug,segments])=>segments.map(d=>{
      const v=load[slug]||0;
      const lv=mode==='fatigue'?(v>.55?4:v>=.4?3:v>=.25?2:v>=.15?1:0):(v?Math.max(1,Math.min(4,Math.ceil(v/19*4))):0);
      return `<path d="${d}" fill="${inert.has(slug)?'#6b7f80':palette[lv]}"/>`;
    })).join('');
    return `<svg class="body-view" viewBox="${data.vb}" aria-label="BodyMap ${view}">${paths}</svg>`;
  }).join('');
}
const voice=JSON.parse(await readFile(new URL('narration-meta.json',base),'utf8'));
if(voice.lines.length!==8||voice.lines.some(x=>x.end>x.windowEnd||x.end>60))throw new Error('Narration does not fit the complete 60s storyboard.');
const audio=JSON.parse(await readFile(new URL('composition/assets/music/audio-data.json',base),'utf8'));
if(audio.frames.length<1800)throw new Error('Music analysis does not cover 60 seconds.');
const bands={fps:30,frames:audio.frames.slice(0,1800).map(f=>({bands:f.bands.map(v=>Number(v.toFixed(4)))}))};
const voiced=voice.lines.map(x=>`<audio id="vo-${x.id}" data-audio-group="voiceover" src="${x.path.replace('.wav','-mix.wav')}" data-start="${x.start}" data-duration="${x.duration}" data-track-index="20" data-volume="1"></audio>`).join('\n');
const weights=[82.4,82.1,81.9,81.6,81.3,80.9,80.7,80.3,79.8];
const xy=weights.map((v,i)=>[80+i*78,(40+(82.65-v)/3.4*305)]);
const points=xy.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' ');
const chart=`<svg id="weight-chart" viewBox="0 0 760 430" aria-label="Exemplo público de evolução do peso"><g stroke="#34494a" stroke-width="2">${[82,81,80].map(v=>`<line x1="70" x2="725" y1="${40+(82.65-v)/3.4*305}" y2="${40+(82.65-v)/3.4*305}"/>`).join('')}</g><g fill="#b5c4c4" font-size="27">${[82,81,80].map(v=>`<text x="14" y="${49+(82.65-v)/3.4*305}">${v}</text>`).join('')}</g><polyline id="weight-line" points="${points}" fill="none" stroke="#63e6e2" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>${xy.map((p,i)=>`<circle id="weight-dot-${i}" class="weight-dot" cx="${p[0]}" cy="${p[1]}" r="${i===8?10:6}" fill="#63e6e2"/>`).join('')}<g fill="#b5c4c4" font-size="28"><text x="80" y="404">30 dias</text><text x="704" y="404" text-anchor="end">Hoje</text></g></svg>`;
let html=await readFile(new URL('film.html',base),'utf8');
for(const [key,value] of Object.entries({'<!-- BALANCE_BODY -->':anatomy('balance'),'<!-- FATIGUE_BODY -->':anatomy('fatigue'),'<!-- WEIGHT_CHART -->':chart,'<!-- VOICE_TRACKS -->':voiced,'/* AUDIO_DATA */':JSON.stringify(bands)})) {
  if(!html.includes(key))throw new Error(`Missing ${key}`);
  html=html.replace(key,value);
}
let mix=null;
try {mix=JSON.parse(await readFile(new URL('music-mix.json',base),'utf8'));} catch (error) {if(error.code!=='ENOENT')throw error;}
if(mix) {
  if(JSON.stringify(mix.voiceFingerprints)!==JSON.stringify(voice.lines.map(x=>x.fingerprint)))throw new Error('Narration changed; refresh music-mix.json using the carve workflow.');
  const encoded=Object.entries(mix.attributes).map(([name,value])=>`${name}="${JSON.stringify(value).replaceAll('&','&amp;').replaceAll('"','&quot;')}"`).join(' ');
  html=html.replace(/<audio\b[^>]*\bid="music-bed"[^>]*>/,tag=>tag.replace(/\sdata-(?:fx-chain|fx-carve|automation)="[^"]*"/g,'').replace(/>$/,` ${encoded}>`));
}
await writeFile(new URL('composition/index.html',base),html);
console.log('Built 60s / 1800 frames, eight measured voice tracks, original anatomy and music data.');
