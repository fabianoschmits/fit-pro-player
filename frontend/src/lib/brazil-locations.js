const IBGE = 'https://servicodados.ibge.gov.br/api/v1/localidades'

export const BRAZILIAN_STATES = Object.freeze([
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
])

async function readJson(response, code) {
  if (!response?.ok) throw new Error(code)
  const data = await response.json()
  if (!Array.isArray(data)) throw new Error(code)
  return data
}

export async function fetchBrazilianStates(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') return [...BRAZILIAN_STATES]
  try {
    const data = await readJson(await fetchImpl(`${IBGE}/estados?orderBy=nome`), 'brazil-states-unavailable')
    const parsed = data
      .map(item => ({ uf: String(item?.sigla || '').toUpperCase(), name: String(item?.nome || '').trim() }))
      .filter(item => item.uf.length === 2 && item.name)
    return parsed.length ? parsed : [...BRAZILIAN_STATES]
  } catch {
    return [...BRAZILIAN_STATES]
  }
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
