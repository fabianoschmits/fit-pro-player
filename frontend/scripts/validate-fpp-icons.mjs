import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/assets/icons/fpp')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
const files = []
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else if (entry.name.endsWith('.svg')) files.push(file) } }
walk(root)
const errors = []; const ids = new Set()
for (const icon of manifest) { if (ids.has(icon.id)) errors.push(`duplicate id: ${icon.id}`); ids.add(icon.id) }
for (const file of files) { const rel = path.relative(root, file).replaceAll(path.sep, '/'); const source = fs.readFileSync(file, 'utf8'); if (!source.includes('viewBox="0 0 24 24"')) errors.push(`${rel}: invalid viewBox`); if (/<text\b|<image\b|base64|data:image/i.test(source)) errors.push(`${rel}: forbidden content`); if (/(?:fill|stroke)\s*=\s*["']#|(?:fill|stroke)\s*=\s*["'](?:rgb|hsl)/i.test(source)) errors.push(`${rel}: fixed color`); if (/(?:^|\s)(?:width|height)\s*=/.test(source)) errors.push(`${rel}: explicit width/height`); if (!manifest.some(icon => icon.file === rel)) errors.push(`${rel}: missing from manifest`) }
for (const icon of manifest) if (!files.some(file => path.relative(root, file).replaceAll(path.sep, '/') === icon.file)) errors.push(`${icon.id}: missing file`)
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }; console.log(`Validated ${files.length} FPP SVG icon(s).`)
