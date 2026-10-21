import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {schedule,wrapCaption,toSrt} from './timing.mjs';
const base=new URL('./',import.meta.url);
const cfg=JSON.parse(await readFile(new URL('narration.json',base),'utf8'));
const cli=fileURLToPath(new URL('composition/node_modules/hyperframes/bin/hyperframes.mjs',base));
const python=fileURLToPath(new URL('../brag-output/one-minute/.venv/Scripts/python.exe',base));
const dir=new URL('composition/assets/voice/',base);
await mkdir(dir,{recursive:true});
let cache={};try{cache=JSON.parse(await readFile(new URL('voice-cache.json',base),'utf8'));}catch{}
function run(command,args,env={}) {return new Promise((resolve,reject)=>{const p=spawn(command,args,{cwd:fileURLToPath(base),windowsHide:true,env:{...process.env,...env}});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>code===0?resolve(out):reject(new Error(err||out)));});}
const duration=async path=>Number(await run('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',path]));
const jobs=cfg.chapters.flatMap(c=>c.lines.map((text,i)=>({id:`${c.id}-${String(i+1).padStart(2,'0')}`,chapter:c.id,text,spoken:text.replaceAll('Fit Pro Player','Fit Pró Plêier').replaceAll('BodyMap','Bódi Mép').replaceAll('fitpp.com.br','fit pê pê ponto com ponto bê érre')})));
let next=0;
await Promise.all(Array.from({length:2},async()=>{
  while(next<jobs.length){
    const job=jobs[next++];
    const hash=createHash('sha256').update(JSON.stringify([job.spoken,cfg.voice,cfg.lang,cfg.speed])).digest('hex');
    const raw=fileURLToPath(new URL(`${job.id}.raw.wav`,dir));
    const clean=fileURLToPath(new URL(`${job.id}.clean.wav`,dir));
    if(cache[job.id]?.hash!==hash || !(await stat(clean).catch(()=>null))){
      const input=fileURLToPath(new URL(`${job.id}.txt`,dir));await writeFile(input,job.spoken+'\n');
      const out=await run(process.execPath,[cli,'tts',input,'--voice',cfg.voice,'--lang',cfg.lang,'--speed',String(cfg.speed),'--output',raw,'--json'],{HYPERFRAMES_PYTHON:python,HYPERFRAMES_NO_TELEMETRY:'1'});
      const result=JSON.parse(out.trim().split('\n').at(-1));
      if(!result.langApplied)throw new Error(`pt-br phonemization missing: ${job.id}`);
      await run('ffmpeg',['-v','error','-y','-i',raw,'-af','silenceremove=start_periods=1:start_duration=0.01:start_threshold=-52dB:start_silence=0.035,areverse,silenceremove=start_periods=1:start_duration=0.01:start_threshold=-52dB:start_silence=0.045,areverse','-ar','48000','-ac','1','-c:a','pcm_s16le',clean]);
      cache[job.id]={hash,duration:await duration(clean)};
      await writeFile(new URL('voice-cache.json',base),JSON.stringify(cache,null,2)+'\n');
    }
    Object.assign(job,{duration:cache[job.id].duration,clean});
    console.log(`${job.id}: ${job.duration.toFixed(3)}s`);
  }
}));
const meta={provider:'kokoro',voice:cfg.voice,lang:cfg.lang,duration:180,chapters:[],lines:[]};
const speechWindow=180-cfg.chapters.length*.24-(jobs.length-cfg.chapters.length)*.09;
const commonTempo=jobs.reduce((sum,j)=>sum+j.duration,0)/speechWindow;
if(commonTempo<.68||commonTempo>1.4)throw new Error(`Revise the script: global tempo ${commonTempo.toFixed(3)}.`);
let chapterCursor=0;
for(const chapter of cfg.chapters){
  const local=jobs.filter(j=>j.chapter===chapter.id);
  const start=chapterCursor;
  const end=cfg.chapters.at(-1)===chapter?180:start+local.reduce((s,j)=>s+j.duration,0)/commonTempo+.24+(local.length-1)*.09;
  chapterCursor=end;
  const slots=schedule(local,start,end);
  const rate=slots[0].rate;
  console.log(`${chapter.id}: tempo ${rate.toFixed(3)}x, ${local.length} measured caption phrases`);
  if(rate<0.68||rate>1.4)throw new Error(`Revise ${chapter.id}: tempo ${rate.toFixed(3)} is outside a natural range.`);
  for(const slot of slots){
    const output=fileURLToPath(new URL(`${slot.id}.wav`,dir));
    await run('ffmpeg',['-v','error','-y','-i',slot.clean,'-af',`atempo=${rate.toFixed(8)},loudnorm=I=-18:TP=-3:LRA=7,aresample=48000,apad,atrim=duration=${slot.duration.toFixed(8)}`,'-ar','48000','-ac','1','-c:a','pcm_s16le',output]);
    meta.lines.push({id:slot.id,chapter:chapter.id,text:slot.text,lines:wrapCaption(slot.text,32),start:Number(slot.start.toFixed(6)),end:Number(slot.end.toFixed(6)),duration:Number(slot.duration.toFixed(6)),tempo:rate,path:`assets/voice/${slot.id}.wav`});
  }
  meta.chapters.push({id:chapter.id,start,end,title:chapter.title,tempo:rate});
}
await writeFile(new URL('narration-meta.json',base),JSON.stringify(meta,null,2)+'\n');
await writeFile(new URL('fit-pro-player-3min.srt',base),toSrt(meta.lines));
await writeFile(new URL('roteiro.txt',base),cfg.chapters.map(c=>c.title+'\n'+c.lines.join(' ')).join('\n\n')+'\n');
console.log(`READY: ${meta.lines.length} measured voice/caption pairs, ${meta.lines.reduce((s,l)=>s+l.duration,0).toFixed(2)}s narration.`);
