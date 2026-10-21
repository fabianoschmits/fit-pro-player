import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const base=new URL('./',import.meta.url),comp=fileURLToPath(new URL('composition/',base));
const cli=fileURLToPath(new URL('composition/node_modules/hyperframes/bin/hyperframes.mjs',base));
const voice=JSON.parse(await readFile(new URL('narration-meta.json',base),'utf8'));
const times=voice.chapters.flatMap(c=>[c.start+.6,c.start+(c.end-c.start)*.33,c.start+(c.end-c.start)*.62,c.end-.6]).concat([0,179.8]);
await mkdir(new URL('qc/',base),{recursive:true});
const p=spawnSync(process.execPath,[cli,'check','--at',times.map(t=>t.toFixed(3)).join(','),'--snapshots','--json'],{cwd:comp,windowsHide:true,maxBuffer:32*1024*1024,env:{...process.env,HYPERFRAMES_NO_TELEMETRY:'1'}});
await writeFile(new URL('qc/check.json',base),p.stdout);
if(p.stderr.length)console.log(p.stderr.toString().slice(-1200));
let j;try{j=JSON.parse(p.stdout);}catch{console.log(p.stdout.toString().slice(-2000));process.exit(p.status||1);}
for(const k of ['ok','browserSkipped','lint','runtime','layout','motion','contrast','snapshots']){
 const x=j[k];if(x==null)continue;
 if(typeof x!=='object')console.log(k,x);
 else console.log(k,JSON.stringify(x,(key,value)=>['findings','samples','checks','frames'].includes(key)&&Array.isArray(value)?value.filter(v=>v.severity==='error').slice(0,12):value).slice(0,4500));
}
process.exit(p.status||0);
