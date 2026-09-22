const RENEWAL_WINDOW_MS = 30_000

function expiryFromAccessToken(accessToken) {
  try {
    const payload = accessToken.split('.')[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '=')))
    return typeof decoded.exp === 'number' && Number.isFinite(decoded.exp) ? decoded.exp * 1_000 : null
  } catch {
    return null
  }
}

export function createSupabaseTokenBroker({ requestBootstrap, clock = Date.now }) {
  let accessToken = null
  let expiresAt = null
  let inFlight = null
  let generation = 0

  const clear = () => {
    generation += 1
    accessToken = null
    expiresAt = null
    inFlight = null
  }

  return {
    getAccessToken() {
      if (accessToken && expiresAt !== null && expiresAt - clock() > RENEWAL_WINDOW_MS) return Promise.resolve(accessToken)
      if (inFlight) return inFlight

      const requestGeneration = generation
      let bootstrap
      try {
        bootstrap = requestBootstrap()
      } catch (error) {
        bootstrap = Promise.reject(error)
      }

      const request = Promise.resolve(bootstrap)
        .then(response => {
          const nextAccessToken = response.access_token
          if (requestGeneration === generation) {
            accessToken = nextAccessToken
            expiresAt = expiryFromAccessToken(nextAccessToken)
          }
          return nextAccessToken
        })
        .catch(error => {
          if (error?.status === 401 || error?.status === 403) clear()
          throw error
        })
        .finally(() => {
          if (inFlight === request) inFlight = null
        })

      inFlight = request
      return request
    },

    clear,
  }
}
