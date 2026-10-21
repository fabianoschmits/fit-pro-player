import {readFile,writeFile} from 'node:fs/promises';
const base=new URL('./',import.meta.url);
const html=await readFile(new URL('composition/index.html',base),'utf8');
const tag=html.match(/<audio\b[^>]*id="music-bed"[^>]*>/)?.[0];
if(!tag)throw new Error('Music bed missing');
const attrs={};for(const name of ['data-fx-chain','data-fx-carve','data-automation']){
 const value=tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];if(!value)throw new Error(`Missing ${name}`);
 attrs[name]=value.replaceAll('&quot;','"').replaceAll('&amp;','&');JSON.parse(attrs[name]);
}
if(JSON.parse(attrs['data-fx-carve']).sources.join(',')!=='voiceover')throw new Error('Carve must target the full voice group');
await writeFile(new URL('music-mix.json',base),JSON.stringify(attrs,null,2)+'\n');
console.log('Saved native music carve and seven automation lanes against voiceover.');
