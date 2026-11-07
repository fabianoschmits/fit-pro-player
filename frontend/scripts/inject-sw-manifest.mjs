import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { injectServiceWorker } from './precache-manifest.mjs'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const result=injectServiceWorker(root)
console.log(`[PWA] Precache manifest injected: ${result.count} entries, ~${(result.size/1024/1024).toFixed(2)} MB`)
