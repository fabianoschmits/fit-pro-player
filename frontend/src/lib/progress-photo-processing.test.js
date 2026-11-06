import { describe, it, expect } from 'vitest'
import { imageSignature, fittedDimensions } from './progress-photo-processing.js'

describe('processamento privado de fotos', () => {
  it('valida conteúdo em vez da extensão', () => {
    expect(imageSignature(new Uint8Array([255,216,255,224]))).toBe('image/jpeg')
    expect(imageSignature(new TextEncoder().encode('<svg onload=x>'))).toBe(null)
    expect(imageSignature(new TextEncoder().encode('RIFFxxxxWEBP'))).toBe('image/webp')
  })
  it('preserva proporção e não amplia imagens pequenas', () => {
    expect(fittedDimensions(3000, 6000)).toEqual({ width: 960, height: 1920 })
    expect(fittedDimensions(500, 1000)).toEqual({ width: 500, height: 1000 })
    expect(() => fittedDimensions(0, 100)).toThrow()
  })
})
