import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import bodies from './composition/assets/body-paths.js';

const here = new URL('./', import.meta.url);
const balance = {chest:18, 'upper-back':17, deltoids:14, biceps:9, triceps:11, abs:10, obliques:7, gluteal:16, quadriceps:19, hamstring:14, calves:8};
const fatigue = {chest:.68, 'upper-back':.28, deltoids:.55, biceps:.22, triceps:.62, abs:.18, obliques:.12, gluteal:.34, quadriceps:.47, hamstring:.30, calves:.08};
const inert = new Set(['head','hair','neck','hands','feet','knees','ankles']);
const ramp = ['#37494a','#266061','#1e7374','#168283','#0F8B8D'];
const heat = ['#37494a','#6f7650','#ffd60a','#ff9f0a','#ff453a'];
const thresholds = [{at:0,level:0},{at:.15,level:1},{at:.25,level:2},{at:.4,level:3},{at:.55,level:4,exclusive:true}];

// Same level buckets as frontend/src/lib/muscles.js; only public demo loads.
function level(value, mode) {
  if (mode === 'fatigue') return thresholds.reduce((lv, rule) => (rule.exclusive ? value > rule.at : value >= rule.at) ? rule.level : lv, 0);
  return value ? Math.max(1, Math.min(4, Math.ceil(value / 19 * 4))) : 0;
}

function bodyMap(mode) {
  const load = mode === 'fatigue' ? fatigue : balance;
  return ['front','back'].map(view => {
    const data = bodies.male[view];
    const paths = Object.entries(data.p).flatMap(([slug, segments]) => segments.map(d => {
      const color = inert.has(slug) ? '#6b7f80' : (mode === 'fatigue' ? heat : ramp)[level(load[slug] || 0, mode)];
      return `<path d="${d}" fill="${color}" data-muscle="${slug}"/>`;
    })).join('');
    return `<svg class="body-view" viewBox="${data.vb}" aria-label="BodyMap ${view === 'front' ? 'frontal' : 'posterior'}">${paths}</svg>`;
  }).join('');
}

const rawAudio = JSON.parse(await readFile(new URL('composition/assets/music/audio-data.json', here), 'utf8'));
const audio = {fps:rawAudio.fps, frames:rawAudio.frames.slice(0,600).map(f => ({bands:f.bands.map(v => Number(v.toFixed(4)))}))};
const template = await readFile(new URL('film.html', here), 'utf8');
const replacements = {'<!-- BALANCE_BODY -->':bodyMap('balance'), '<!-- FATIGUE_BODY -->':bodyMap('fatigue'), '/* AUDIO_DATA */':JSON.stringify(audio)};
let html = template;
for (const [token, value] of Object.entries(replacements)) {
  if (!html.includes(token)) throw new Error(`Missing template token: ${token}`);
  html = html.replace(token, value);
}
await writeFile(new URL('composition/index.html', here), html);
console.log(`Built ${fileURLToPath(new URL('composition/index.html', here))}: real anatomical paths, ${audio.frames.length} audio frames.`);
