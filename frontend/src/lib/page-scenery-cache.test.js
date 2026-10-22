// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { preloadPageScenery } from './page-scenery-cache.js'

describe('preloadPageScenery', () => {
  afterEach(() => vi.restoreAllMocks())

  it('warms the browser and PWA cache with every background for the active theme', async () => {
    const requested = []
    const NativeImage = window.Image
    class ImageProbe extends NativeImage {
      set src(value) {
        requested.push(value)
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('Image', ImageProbe)

    await preloadPageScenery('dark')

    expect(requested).toHaveLength(4)
    expect(requested.every(url => url.includes('dark'))).toBe(true)
  })
})
