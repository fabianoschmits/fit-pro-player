const LOADERS = Object.freeze({
  preferences: 'loadPreferences',
  plan: 'loadPlan',
  history: 'loadHistory',
  body: 'loadBody',
})

const emptyStatus = () => Object.fromEntries(Object.keys(LOADERS).map(domain => [domain, { state: 'idle', error: null }]))

export function attachDomainFocusRefresh({ target = globalThis.window, refresh, domains = ['preferences', 'plan', 'history', 'body'] } = {}) {
  if (!target?.addEventListener || typeof refresh !== 'function') return () => {}
  const onFocus = () => { domains.forEach(domain => { void refresh(domain) }) }
  target.addEventListener('focus', onFocus)
  return () => target.removeEventListener('focus', onFocus)
}

/**
 * Coordinates independently-owned account reads.  The caller owns state
 * projection; this boundary owns scope freshness and keeps existing UI data
 * intact when one domain cannot be refreshed.
 */
export function createDomainRefresh({ accountId, repository, apply, isCurrent = () => true, onStatus = () => {} } = {}) {
  if (typeof accountId !== 'string' || !accountId || !repository || typeof apply !== 'function') {
    throw new TypeError('invalid-domain-refresh-scope')
  }

  const domains = emptyStatus()
  const publish = () => onStatus(status())
  const status = () => ({ accountId, domains: Object.fromEntries(Object.entries(domains).map(([name, value]) => [name, { ...value }])) })
  const current = () => isCurrent(accountId) === true

  async function refresh(domain) {
    const loader = LOADERS[domain]
    if (!loader) throw new TypeError('unknown-domain-refresh')
    if (!current()) return { state: 'stale', domain }
    if (typeof repository[loader] !== 'function') {
      const error = new TypeError(`missing-domain-loader:${domain}`)
      domains[domain] = { state: 'error', error }
      publish()
      return { state: 'error', domain, error }
    }

    domains[domain] = { state: 'loading', error: null }
    publish()
    try {
      const value = await repository[loader]()
      if (!current()) return { state: 'stale', domain }
      apply(domain, value)
      domains[domain] = { state: 'ready', error: null }
      publish()
      return { state: 'ready', domain, value }
    } catch (error) {
      if (!current()) return { state: 'stale', domain }
      domains[domain] = { state: 'error', error }
      publish()
      return { state: 'error', domain, error }
    }
  }

  async function boot() {
    const results = await Promise.all(Object.keys(LOADERS).map(refresh))
    if (!current() || results.some(result => result.state === 'stale')) return { state: 'stale', domains: status().domains }
    const domainStates = Object.fromEntries(results.map(result => [result.domain, result.state]))
    return { state: results.some(result => result.state === 'error') ? 'partial' : 'ready', domains: domainStates }
  }

  return Object.freeze({ refresh, boot, status })
}
