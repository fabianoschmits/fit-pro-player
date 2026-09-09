const fs = require('fs');
const ptNames = require('../frontend/src/generated/pt-exercise-names.js').default || require('../frontend/src/generated/pt-exercise-names.js');
const srcDir = 'C:\\\\Users\\\\FabianoSchmits\\\\Downloads\\\\Exercicios\\\\novos\\\\Novos';
const destBaseDir = './frontend/src/assets/workout-guide';

const manualMap = {
  'Extensão de tríceps alto polia acima da cabeça': '1722',
  'uxada suporte com barra': '0074'
};

const dirs = fs.readdirSync(srcDir).filter(f => fs.statSync(srcDir + '/' + f).isDirectory());
let mapped = [];

for (let d of dirs) {
  let matchedId = manualMap[d] || Object.keys(ptNames).find(id => ptNames[id].toLowerCase() === d.toLowerCase());
  if (matchedId) {
    mapped.push({ ptName: d, id: matchedId });
  }
}

const exDataContent = fs.readFileSync('./frontend/src/lib/exercises-data.js', 'utf8');
const exDataMatch = exDataContent.match(/export const EXDB\s*=\s*(\[[\s\S]*\]);/);
let slugs = {};
if (exDataMatch) {
  const exdb = JSON.parse(exDataMatch[1]);
  for (let e of exdb) {
    slugs[e.id] = e.n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
}

mapped = mapped.map(m => ({ ...m, slug: slugs[m.id] || 'unknown-slug-' + m.id }));

fs.rmSync(destBaseDir, { recursive: true, force: true });
fs.mkdirSync(destBaseDir, { recursive: true });

let newGuideById = {};
mapped.forEach(item => {
  const folderPath = srcDir + '/' + item.ptName;
  const pngFiles = fs.readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.png')).sort();
  if (pngFiles.length === 0) return; // skip if no pngs
  
  const svgFrames = pngFiles.map(pngFile => {
    const filePath = folderPath + '/' + pngFile;
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><image href="data:image/png;base64,${base64}" width="512" height="512"/></svg>`;
  });

  const destFolder = destBaseDir + '/' + item.slug;
  if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });

  const framesJsPath = destFolder + '/frames.js';
  const code = `// Sprites Academia V3 - ${item.ptName}\nconst FRAMES = Object.freeze(${JSON.stringify(svgFrames)})\nexport default FRAMES\n`;
  fs.writeFileSync(framesJsPath, code, 'utf8');
  
  newGuideById[item.id] = item.slug;
  console.log(`Generated ${item.slug} with ${svgFrames.length} frames`);
});

let assetsCode = fs.readFileSync('./frontend/src/lib/exercise-guide-assets.js', 'utf8');
assetsCode = assetsCode.replace(/export const WORKOUT_GUIDE_BY_EXERCISE_ID = Object\.freeze\(\{[\s\S]*?\}\)/, 
  'export const WORKOUT_GUIDE_BY_EXERCISE_ID = Object.freeze(' + JSON.stringify(newGuideById, null, 2) + ')');

fs.writeFileSync('./frontend/src/lib/exercise-guide-assets.js', assetsCode, 'utf8');
console.log('Done!');
