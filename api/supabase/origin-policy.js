function normalizedUrl(value, { native = false, referer = false } = {}) {
  if (typeof value !== 'string' || !value.trim()) return null

  try {
    const url = new URL(value.trim())
    if (url.username || url.password) return null

    if (url.protocol === 'http:' || url.protocol === 'https:') {
      if (!referer && (url.pathname !== '/' || url.search || url.hash)) return null
      return url.origin
    }

    if (native && url.protocol === 'capacitor:' && url.hostname && !url.port && (url.pathname === '' || url.pathname === '/') && !url.search && !url.hash) {
      return `${url.protocol}//${url.hostname}`
    }
  } catch {}

  return null
}

function isPathlessRawOrigin(value) {
  return typeof value === 'string'
    && /^[a-z][a-z\d+.-]*:\/\/[^/?#]+$/i.test(value.trim())
}

function configuredOrigins(values, options) {
  return new Set((Array.isArray(values) ? values : [])
    .map(value => normalizedUrl(value, options))
    .filter(Boolean))
}

export function createOriginPolicy({ allowedOrigins = [], nativeOrigins = [] } = {}) {
  const webOrigins = configuredOrigins(allowedOrigins)
  const configuredNativeOrigins = configuredOrigins(nativeOrigins, { native: true })

  const check = req => {
    const headers = req?.headers || {}
    if (headers.origin !== undefined) {
      if (!isPathlessRawOrigin(headers.origin)) return false
      const origin = normalizedUrl(headers.origin, { native: true })
      return Boolean(origin && (webOrigins.has(origin) || configuredNativeOrigins.has(origin)))
    }

    const referer = normalizedUrl(headers.referer, { native: true, referer: true })
    return Boolean(referer && (webOrigins.has(referer) || configuredNativeOrigins.has(referer)))
  }

  return Object.freeze({ check })
}
