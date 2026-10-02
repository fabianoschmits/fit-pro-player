import { describe, expect, it, vi } from 'vitest'
import { planExerciseIds, cacheOfflineAssets } from './offline-plan.js'

describe('offline plan preparation', () => {
  it('selects only exercises in the plan/session and deduplicates them', () => {
    expect(planExerciseIds({routines:[{ex:[{id:'0025'},{id:'0043'},{id:'0025'}]}],active:{entries:[{id:'0043'},{id:'0032'}]}})).toEqual(['0025','0043','0032'])
  })
  it('rejects cross-origin assets and reports failed caching instead of readiness', async () => {
    const put=vi.fn(), cache={match:vi.fn(),put}
    const fetch=vi.fn(async()=>new Response('ok'))
    const result=await cacheOfflineAssets(['/assets/sprite.webp','https://other.example/private'],{origin:'https://fit.example',cacheStorage:{open:async()=>cache},fetch})
    expect(result.ready).toBe(false);expect(result.failed).toEqual(['https://other.example/private']);expect(put).toHaveBeenCalledTimes(1)
  })
  it('keeps already cached images available when the network fails', async () => {
    const cache={match:async()=>new Response('cached'),put:vi.fn()}
    const fetch=vi.fn(()=>{throw new Error('offline')})
    const result=await cacheOfflineAssets(['/assets/sprite.webp'],{origin:'https://fit.example',cacheStorage:{open:async()=>cache},fetch})
    expect(result.ready).toBe(true);expect(fetch).not.toHaveBeenCalled()
  })
})
