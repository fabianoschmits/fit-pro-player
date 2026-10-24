import { describe, expect, it } from 'vitest'
import { fmtHistoryDate, fmtTrainingVolume } from './format.js'

describe('history presentation', () => {
  it('spells out the weekday without the Portuguese feira suffix', () => {
    expect(fmtHistoryDate('2026-10-21')).toBe('Quarta, 21 de out.')
  })

  it('labels total load and expresses large totals in tonnes', () => {
    expect(fmtTrainingVolume(14466, 'kg')).toBe('Volume: 14,5 t')
    expect(fmtTrainingVolume(850, 'kg')).toBe('Volume: 850 kg')
  })
})
