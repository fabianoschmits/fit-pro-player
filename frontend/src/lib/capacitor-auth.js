const ALLOWED_FLOWS = new Set(['confirm', 'recovery'])

export function parseCapacitorAuthUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null
  let url
  try { url = new URL(rawUrl) } catch { return null }
  if (url.protocol !== 'fitproplayer:') return null
  const flow = url.searchParams.get('auth_flow')
  const code = url.searchParams.get('code')
  if (!ALLOWED_FLOWS.has(flow) || !code || url.hash) return null
  return Object.freeze({ flow, code })
}

export function callbackUrlFromCapacitorLink(rawUrl, origin = 'http://localhost') {
  const callback = parseCapacitorAuthUrl(rawUrl)
  if (!callback) return null
  const url = new URL(origin)
  url.pathname = '/'
  url.searchParams.set('auth_flow', callback.flow)
  url.searchParams.set('code', callback.code)
  return url.toString()
}
