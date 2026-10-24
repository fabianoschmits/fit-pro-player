import { expect, it, vi } from 'vitest'
import { canReloadForUpdate, acquireUpdateBlocker } from './reload-safety.js'
it('defers application reload during an unfinished workout',()=>{
  expect(canReloadForUpdate({active:{id:'session'}})).toBe(false)
  expect(canReloadForUpdate({active:null})).toBe(true)
})
it('preserves community drafts and uploads until every update blocker is released', () => {
  const releaseDraft = acquireUpdateBlocker(), releaseUpload = acquireUpdateBlocker()
  expect(canReloadForUpdate({})).toBe(false)
  releaseDraft(); expect(canReloadForUpdate({})).toBe(false)
  releaseUpload(); expect(canReloadForUpdate({})).toBe(true)
})
it('waits until effect replacements finish before allowing a pending PWA reload', async () => {
  const events = new EventTarget(), reloadChecks = []
  vi.stubGlobal('window', events)
  events.addEventListener('fitproplayer:reload-safety-changed', () => reloadChecks.push(canReloadForUpdate({})))
  const releaseFirst = acquireUpdateBlocker()
  releaseFirst()
  const releaseReplacement = acquireUpdateBlocker()
  try {
    expect(reloadChecks).toEqual([])
    await Promise.resolve()
    expect(reloadChecks).toEqual([false])
    releaseReplacement()
    await Promise.resolve()
    expect(reloadChecks).toEqual([false, true])
  } finally { releaseReplacement(); vi.unstubAllGlobals() }
})
