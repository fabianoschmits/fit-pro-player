/**
 * Background preloader for exercise sprite assets.
 *
 * After the Service Worker is active, this module downloads the frame images
 * and JS loader chunks for the exercises in the user's current plan into the
 * fpp-exercise-media-v1 cache.  Subsequent offline sessions can then animate
 * those exercises without any network access.
 *
 * Rules:
 * - Never blocks the UI — everything runs asynchronously in the background.
 * - Checks the cache before fetching; never re-downloads what is already stored.
 * - Skips silently when offline; will be triggered again when the plan changes.
 */
import { EXERCISE_SPRITE_BY_EXERCISE_ID } from './exercise-guide-assets.js'

const FRAME_LOADERS = import.meta.glob(
  '../assets/exercise-sprites/*/frames.js',
  { import: 'default' },
)

/** Slugs that have been preloaded in the current session (in-memory dedup). */
const preloadedSlugs = new Set()
const pendingSlugs = new Set()

/**
 * Preload sprite frames for a list of exercise IDs.
 * Call this in the background; it never rejects.
 */
export async function preloadExerciseSpritesByIds(exerciseIds) {
  if (!Array.isArray(exerciseIds) || exerciseIds.length === 0) return

  const slugs = [
    ...new Set(
      exerciseIds
        .map(id => EXERCISE_SPRITE_BY_EXERCISE_ID[id])
        .filter(Boolean),
    ),
  ]

  for (const slug of slugs) {
    if (preloadedSlugs.has(slug) || pendingSlugs.has(slug)) continue
    pendingSlugs.add(slug)
    try {
      const key = `../assets/exercise-sprites/${slug}/frames.js`
      const loader = FRAME_LOADERS[key]
      if (!loader) continue
      // Loading the chunk triggers the Service Worker to cache it in EXERCISE_CACHE.
      const frames = await loader()
      if (!Array.isArray(frames)) continue
      // Fetch and explicitly store in EXERCISE_CACHE so frames are available offline
      // even if the page was not yet controlled by the Service Worker when preloading began.
      const cacheName = 'fpp-exercise-media-v1'
      let cache = null
      try {
        if (typeof caches !== 'undefined') cache = await caches.open(cacheName)
      } catch { /* optional browser operation may be unavailable */ }
      const results = await Promise.all(
        frames.map(async url => {
          try {
            const fullUrl = new URL(url, location.href).href
            if (await cache?.match(fullUrl)) return true
            const res = await fetch(url)
            if (res.ok && cache) {
              // The worker owns controlled requests; this fallback covers first installation.
              if (!navigator.serviceWorker?.controller) {
                try { await cache.put(fullUrl, res.clone()) }
                catch (error) {
                  if (error?.name !== 'QuotaExceededError') return false
                  const keys = await cache.keys()
                  await Promise.all(keys.slice(0, Math.max(1, keys.length - 300)).map(key => cache.delete(key)))
                  try { await cache.put(fullUrl, res.clone()) } catch { return false }
                }
              }
              return true
            }
            return false
          } catch { return false }
        }),
      )
      if (cache) {
        const keys = await cache.keys()
        await Promise.all(keys.slice(0, Math.max(0, keys.length - 600)).map(key => cache.delete(key)))
      }
      if (results.every(Boolean)) preloadedSlugs.add(slug)
    } catch {
      /* individual preload failures are retried after reconnect */
    } finally { pendingSlugs.delete(slug) }
  }
}

/**
 * Extract all exercise IDs referenced in the user's plan routines.
 * routines is the array from the store: each routine has an `ex` array of exercise objects.
 */
export function getPlanExerciseIds(routines) {
  if (!Array.isArray(routines)) return []
  return [
    ...new Set(
      routines.flatMap(r => (Array.isArray(r.ex) ? r.ex : []).map(e => e.id).filter(Boolean)),
    ),
  ]
}
