import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';

const base = new URL('./',import.meta.url);
const config = JSON.parse(await readFile(new URL('narration.json',base),'utf8'));
const cli = fileURLToPath(new URL('composition/node_modules/hyperframes/bin/hyperframes.mjs',base));
const python = fileURLToPath(new URL('.venv/Scripts/python.exe',base));
const voiceDir = new URL('composition/assets/voice/',base);
await mkdir(voiceDir,{recursive:true});
let saved = {};
try {saved = JSON.parse(await readFile(new URL('narration-meta.json',base),'utf8'));} catch {}
const metadata = {provider:'kokoro',voice:config.voice,lang:config.lang,lines:[]};

function invoke(args) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[cli,...args],{cwd:fileURLToPath(base),env:{...process.env,HYPERFRAMES_PYTHON:python},windowsHide:true});
    let out='',err='';
    child.stdout.on('data',d=>{out+=d;});
    child.stderr.on('data',d=>{err+=d;});
    child.on('error',reject);
    child.on('close',code=>code===0?resolve(JSON.parse(out.trim().split('\n').at(-1))):reject(new Error(err||out||`TTS exited ${code}`)));
  });
}

for (const line of config.lines) {
  const fingerprint=createHash('sha256').update(JSON.stringify({text:line.text,voice:config.voice,lang:config.lang,speed:config.speed})).digest('hex');
  const prior=saved.lines?.find(x=>x.id===line.id&&x.fingerprint===fingerprint);
  if(prior) {
    try {const b=await readFile(new URL(`composition/assets/voice/${line.id}.wav`,base));if(b.length>44) {metadata.lines.push(prior);console.log(`${line.id}: reusing ${prior.duration}s`);continue;}} catch {}
  }
  console.log(`Generating ${line.id} with ${config.voice}, ${config.lang}...`);
  const textPath=new URL(`composition/assets/voice/${line.id}.txt`,base);
  await writeFile(textPath,line.text+'\n');
  const output=new URL(`composition/assets/voice/${line.id}.wav`,base);
  let speed=config.speed;
  let result=await invoke(['tts',fileURLToPath(textPath),'--voice',config.voice,'--lang',config.lang,'--speed',String(speed),'--output',fileURLToPath(output),'--json']);
  const window=line.end-line.start;
  if(result.durationSeconds>window) {
    speed=Math.min(1.3,Math.ceil(speed*result.durationSeconds/window*1.04*100)/100);
    console.log(`${line.id}: ${result.durationSeconds}s exceeds ${window.toFixed(2)}s; regenerating at ${speed}x.`);
    result=await invoke(['tts',fileURLToPath(textPath),'--voice',config.voice,'--lang',config.lang,'--speed',String(speed),'--output',fileURLToPath(output),'--json']);
  }
  if(!result.langApplied) throw new Error(`Portuguese phonemization was not applied to ${line.id}`);
  if(result.durationSeconds>window) throw new Error(`${line.id}: narration still too long (${result.durationSeconds}s / ${window}s); shorten the script.`);
  const record={id:line.id,start:line.start,windowEnd:line.end,duration:result.durationSeconds,end:line.start+result.durationSeconds,speed,path:`assets/voice/${line.id}.wav`,fingerprint};
  metadata.lines.push(record);
  await writeFile(new URL('narration-meta.json',base),JSON.stringify(metadata,null,2)+'\n');
  console.log(`${line.id}: ${record.duration}s at ${speed}x, plays ${record.start.toFixed(2)}–${record.end.toFixed(2)}s.`);
}
await writeFile(new URL('narration-meta.json',base),JSON.stringify(metadata,null,2)+'\n');
console.log(`Narration complete: ${metadata.lines.length} measured Portuguese segments.`);
