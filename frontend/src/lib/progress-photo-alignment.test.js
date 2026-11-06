import { describe, it, expect } from 'vitest'
import { alignmentFromLandmarks, defaultTransform, clampTransform, analyzeProgressPhoto } from './progress-photo-alignment.js'

describe('alinhamento sem deformação', () => {
  it('contém a imagem inteira no quadro vertical', () => {
    expect(defaultTransform(1000, 1000)).toEqual({ scale: .75, x: 0, y: .125 })
    expect(defaultTransform(1000, 2000)).toEqual({ scale: 1, x: .125, y: 0 })
  })
  it('rejeita pontos com baixa confiança', () => {
    expect(alignmentFromLandmarks([], 1000, 2000, 'front')).toBe(null)
  })
  it('ancora o rosto em posição canônica sem esticar os eixos', () => {
    const points = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 1 }))
    for (const i of [0, 2, 5]) points[i] = { x: .5, y: .12, visibility: 1 }
    for (const i of [11, 12]) points[i] = { x: .5, y: .25, visibility: 1 }
    for (const i of [23, 24]) points[i] = { x: .5, y: .5, visibility: 1 }
    for (const i of [27, 28]) points[i] = { x: .5, y: .95, visibility: 1 }
    const result = alignmentFromLandmarks(points, 1000, 2000, 'front')
    expect(result.x + .5 * .5 * result.scale).toBeCloseTo(.375)
    expect(result.y + .12 * result.scale).toBeCloseTo(.12)
    expect(Number.isFinite(result.scale)).toBe(true)
  })
  it('limita transformações inválidas', () => {
    expect(clampTransform({ scale: Infinity, x: NaN, y: 999 })).toEqual({ scale: 1, x: 0, y: 2 })
  })
  it('permite continuar com enquadramento padrão sem suporte a Worker', async () => {
    expect(await analyzeProgressPhoto(new Blob(), 1000, 2000, 'front')).toBe(null)
  })
})
