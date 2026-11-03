const IBGE = 'https://servicodados.ibge.gov.br/api/v1/localidades'

async function readJson(response, code) {
  if (!response?.ok) throw new Error(code)
  const data = await response.json()
  if (!Array.isArray(data)) throw new Error(code)
  return data
}

export async function fetchBrazilianStates(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('brazil-states-unavailable')
  const data = await readJson(await fetchImpl(`${IBGE}/estados?orderBy=nome`), 'brazil-states-unavailable')
  return data
    .map(item => ({ uf: String(item?.sigla || '').toUpperCase(), name: String(item?.nome || '').trim() }))
    .filter(item => item.uf.length === 2 && item.name)
}

export async function fetchBrazilianCities(uf, fetchImpl = globalThis.fetch) {
  const state = String(uf || '').toUpperCase()
  if (!/^[A-Z]{2}$/.test(state)) return []
  if (typeof fetchImpl !== 'function') throw new Error('brazil-cities-unavailable')
  const data = await readJson(await fetchImpl(`${IBGE}/estados/${encodeURIComponent(state)}/municipios?orderBy=nome`), 'brazil-cities-unavailable')
  return data.map(item => ({ id: item?.id, name: String(item?.nome || '').trim() })).filter(item => item.name)
}

export function composeCityRegion({ neighborhood = '', cityName = '', stateUf = '' } = {}) {
  const cityState = [String(cityName || '').trim(), String(stateUf || '').trim().toUpperCase()].filter(Boolean).join(' - ')
  return [String(neighborhood || '').trim(), cityState].filter(Boolean).join(', ') || null
}
