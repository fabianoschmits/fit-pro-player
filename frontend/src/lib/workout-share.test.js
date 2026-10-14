import { describe, expect, it, vi } from 'vitest'
import { dataUrlToPngFile, shareWorkoutImage } from './workout-share.js'

const image = 'data:image/png;base64,AAAA'
const fetchImage = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['png'], { type: 'image/png' }) }))

describe('workout sharing', () => {
  it('creates a PNG file from the generated image', async () => {
    const file = await dataUrlToPngFile(image, 'workout.png', fetchImage)
    expect(file.name).toBe('workout.png')
    expect(file.type).toBe('image/png')
  })

  it('converts a data URL locally without using fetch or the network', async () => {
    const file = await dataUrlToPngFile(image, 'offline.png', () => { throw new Error('network must not be used') })
    expect(file.name).toBe('offline.png')
    expect(file.type).toBe('image/png')
    expect(await file.arrayBuffer()).toBeInstanceOf(ArrayBuffer)
  })

  it('opens the native Capacitor share sheet with a cache URI', async () => {
    const writeFile = vi.fn(async () => ({ uri: 'file:///cache/workout.png' }))
    const nativeShare = vi.fn()
    const result = await shareWorkoutImage(image, {
      fetchImpl: fetchImage,
      capacitor: { isNativePlatform: () => true },
      filesystem: { writeFile },
      directory: 'CACHE',
      share: { share: nativeShare },
    })
    expect(result).toEqual({ method: 'native' })
    expect(writeFile).toHaveBeenCalledWith(expect.objectContaining({ directory: 'CACHE', path: expect.stringContaining('.png') }))
    expect(nativeShare).toHaveBeenCalledWith(expect.objectContaining({ url: 'file:///cache/workout.png' }))
  })

  it('opens Web Share with the generated file when available', async () => {
    const webShare = vi.fn()
    const result = await shareWorkoutImage(image, {
      fetchImpl: fetchImage,
      navigatorObject: { share: webShare, canShare: () => true },
    })
    expect(result).toEqual({ method: 'web' })
    expect(webShare).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.any(File)] }))
  })

  it('downloads only when no native share mechanism is available', async () => {
    const click = vi.fn()
    const remove = vi.fn()
    const documentObject = { body: { appendChild: vi.fn() }, createElement: () => ({ click, remove }) }
    const result = await shareWorkoutImage(image, { fetchImpl: fetchImage, navigatorObject: {}, documentObject })
    expect(result).toEqual({ method: 'download' })
    expect(click).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledOnce()
  })
})
