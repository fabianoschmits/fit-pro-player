import { exerciseGuideAsset } from './exercise-guide-assets.js'
const frames = import.meta.glob('../assets/exercise-sprites/*/frames.js', { import: 'default' })
const CACHE = 'fit-pro-player-plan-media-v1'

export function planExerciseIds(state) {
  return [...new Set([...(state?.routines || []).flatMap(r => (r.ex || []).map(e => e.id)), ...(state?.active?.entries || []).map(e => e.id)].filter(Boolean))]
}

export async function cacheOfflineAssets(assets, { origin = location.origin, cacheStorage = globalThis.caches, fetch = globalThis.fetch, onProgress = () => {} } = {}) {
  if (!cacheStorage?.open) return { ready: false, failed: assets, done: 0, total: assets.length }
  const cache = await cacheStorage.open(CACHE), failed = [], list = [...new Set(assets)]
  // Keep only the current plan, so repeated downloads cannot grow storage forever.
  const wanted = new Set(list.map(asset => new URL(asset, origin).href))
  if (cache.keys && cache.delete) for (const request of await cache.keys()) {
    if (!wanted.has(request.url)) await cache.delete(request)
  }
  let done = 0
  // Sequential downloads avoid starving workout media requests and memory on phones.
  for (const asset of list) {
    try {
      const url = new URL(asset, origin)
      if (url.origin !== origin) throw new Error('cross-origin')
      const hit = await cache.match(url.href)
      if (!hit) {
        const response = await fetch(url.href)
        if (!response.ok) throw new Error('asset-unavailable')
        await cache.put(url.href, response)
      }
    } catch { failed.push(asset) }
    done++; onProgress({ done, total: list.length })
  }
  return { ready: failed.length === 0, failed, done, total: list.length }
}

export async function prepareOfflinePlan(state, options = {}) {
  if (!navigator.serviceWorker?.controller) return { ready: false, error: 'worker-unavailable', failed: [] }
  const assets = [], failed = []
  for (const id of planExerciseIds(state)) {
    const config = exerciseGuideAsset({ id })
    if (!config) continue
    try { assets.push(...await frames[`../assets/exercise-sprites/${config.slug}/frames.js`]()) }
    catch { failed.push(id) }
  }
  // Warm lazy route/instruction modules as well as the raster frames.
  try {
    const { preloadCoreRoutes } = await import('../App.jsx')
    const results = await preloadCoreRoutes()
    if (results.some(result => result.status === 'rejected')) failed.push('routes')
    const { setLang } = await import('./i18n.js'); await setLang(state.lang || 'pt')
    // First-visit shell assets were loaded before the worker gained control. Cache them
    // explicitly too; warming lazy routes alone leaves the entry bundle unavailable offline.
    assets.push(location.pathname || '/')
    for (const entry of performance.getEntriesByType('resource')) {
      const url = new URL(entry.name, location.origin)
      if (url.origin === location.origin && /\.(?:js|css|woff2?)$/.test(url.pathname)) assets.push(url.href)
    }
    for (const node of document.querySelectorAll('script[type="module"][src],link[rel="stylesheet"][href],link[rel="modulepreload"][href]')) assets.push(node.src || node.href)
  } catch { failed.push('modules') }
  const result = await cacheOfflineAssets(assets, options)
  return { ...result, ready: result.ready && !failed.length, failed: [...result.failed, ...failed] }
}
