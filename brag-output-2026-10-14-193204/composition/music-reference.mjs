// Render a music-only QC reference through the exact native audio graph.
// It does not change the approved composition or its delivered mix.
import {readFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {parseAudioElements, processCompositionAudio} from './node_modules/hyperframes/dist/chunk-IRRRH66M.js';

const base = fileURLToPath(new URL('./', import.meta.url));
const work = fileURLToPath(new URL('../qc/audio-reference/', import.meta.url));
await mkdir(work, {recursive:true});
const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const elements = parseAudioElements(html).filter(x => x.id === 'music-bed');
if (elements.length !== 1) throw new Error('Expected the approved music bed.');
const result = await processCompositionAudio(elements, base, work,
  fileURLToPath(new URL('../qc/music-only-reference.m4a', import.meta.url)), 180);
console.log(JSON.stringify(result, null, 2));
if (!result.success) process.exit(1);
