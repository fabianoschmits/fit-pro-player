import { describe, expect, it, vi } from 'vitest'
import { composeCityRegion, fetchBrazilianCities, fetchBrazilianStates } from './brazil-locations.js'

describe('brazil locations', () => {
  it('composes neighborhood, city and UF for display', () => {
    expect(composeCityRegion({ neighborhood: 'Centro', cityName: 'Curitiba', stateUf: 'pr' })).toBe('Centro, Curitiba - PR')
    expect(composeCityRegion({ cityName: 'Curitiba', stateUf: 'PR' })).toBe('Curitiba - PR')
    expect(composeCityRegion({})).toBeNull()
  })

  it('loads Brazilian states and cities from the IBGE API', async () => {
    const fetchImpl = vi.fn(url => Promise.resolve({
      ok: true,
      json: async () => String(url).includes('/municipios')
        ? [{ id: 1, nome: 'Curitiba' }]
        : [{ sigla: 'pr', nome: 'Paraná' }],
    }))
    await expect(fetchBrazilianStates(fetchImpl)).resolves.toEqual([{ uf: 'PR', name: 'Paraná' }])
    await expect(fetchBrazilianCities('pr', fetchImpl)).resolves.toEqual([{ id: 1, name: 'Curitiba' }])
  })
})
