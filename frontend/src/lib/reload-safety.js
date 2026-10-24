const blockers = new Set()
export const canReloadForUpdate = state => !state?.active && blockers.size === 0
export function acquireUpdateBlocker() {
  const token = {}; blockers.add(token)
  return () => {
    if (!blockers.delete(token)) return
    // React runs effect cleanups before their replacements. Wait until the whole
    // commit has registered its blockers so an update cannot interrupt a draft.
    queueMicrotask(() => {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('fitproplayer:reload-safety-changed'))
    })
  }
}
