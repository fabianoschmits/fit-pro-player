import {readFile,writeFile} from 'node:fs/promises';
const base=new URL('./',import.meta.url);
const html=await readFile(new URL('composition/index.html',base),'utf8');
const tag=html.match(/<audio\b[^>]*\bid="music-bed"[^>]*>/)?.[0];
if(!tag)throw new Error('Music bed not found.');
const attrs={};
for(const name of ['data-fx-chain','data-fx-carve','data-automation']) {
  const m=tag.match(new RegExp(name+'="([^"]*)"'));
  if(!m)throw new Error(`Missing ${name}; finish the voice/music mix first.`);
  attrs[name]=JSON.parse(m[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));
}
const voices=JSON.parse(await readFile(new URL('narration-meta.json',base),'utf8'));
await writeFile(new URL('music-mix.json',base),JSON.stringify({voiceFingerprints:voices.lines.map(x=>x.fingerprint),attributes:attrs},null,2)+'\n');
console.log('Saved the validated music carve and automation for reproducible rebuilds.');
