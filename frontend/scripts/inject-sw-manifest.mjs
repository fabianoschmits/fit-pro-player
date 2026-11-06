import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
/**
 * Post-build step: inject Workbox precache manifest into dist/sw.js.
 * Run after `vite build` to produce a versioned, offline-capable service worker.
 */
import { injectManifest } from 'workbox-build'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const dir = dirname(fileURLToPath(import.meta.url))
const root = join(dir, '..')

const result = await injectManifest({
  swSrc: join(root, 'public', 'sw.js'),
  swDest: join(root, 'dist', 'sw.js'),
  globDirectory: join(root, 'dist'),
  globPatterns: [
    'index.html',
    'manifest.json',
    'favicon*.{ico,png}',
    'apple-touch-icon*.png',
    'icons/**/*.{png,ico,svg}',
    'assets/*.js',
    'assets/*.css',
    'assets/*.png',
    'assets/*.webp',
  ],
  globIgnores: [
    // Private photo UI and pose code are loaded only when explicitly used.
    'assets/ProgressPhoto*.js',
    'assets/progress-photo*.js',
    // Exercise sprite frames and loaders — loaded on demand into exercise cache
    'assets/frames-*.js',
    'assets/frame-*.webp',
    'assets/frame-*.png',
    // Avatars — not critical for App Shell
    'assets/avatar-*.webp',
    // Non-Portuguese language packs (too heavy; pt is included via assets/*.js above)
    'assets/hi-*.js',
    'assets/zh-*.js',
    'assets/ko-*.js',
    'assets/ru-*.js',
    'assets/ar-*.js',
  ],
  injectionPoint: 'self.__WB_MANIFEST',
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB per file
})

console.log(`[PWA] Precache manifest injected: ${result.count} entries, ~${(result.size / 1024 / 1024).toFixed(2)} MB`)

const swPath = join(root, 'dist', 'sw.js')
let sw = readFileSync(swPath, 'utf8')
const catalogue = readdirSync(join(root, 'dist', 'assets')).filter(name => /^(frame-.*\.(webp|png)|frames-.*\.js)$/.test(name)).map(name => '/assets/' + name)
const buildId = createHash('sha256').update(sw).digest('hex').slice(0, 16)
sw = sw.replace('__BUILD_ID__', buildId).replace('/* exercise-catalogue */ []', JSON.stringify(catalogue))
if (sw.includes('self.__WB_MANIFEST') || sw.includes('__BUILD_ID__')) throw new Error('Uninjected service worker')
writeFileSync(swPath, sw)
