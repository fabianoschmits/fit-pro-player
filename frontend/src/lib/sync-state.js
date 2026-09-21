// Serializes state uploads and coalesces changes made while a request is in flight.
// This prevents a slower, older request from landing after a newer one and rolling
// the server back. The latest snapshot is always sent before the queue is marked clean.
export function nextStateTimestamp(previous, now = Date.now()) {
  return Math.max(now, (Number(previous) || 0) + 1)
}

export function createStatePushQueue({
  getState, isEnabled, send, markDirty, markClean,
  shouldRetry = () => false,
  retryDelays = [],
  wait = ms => new Promise(resolve => window.setTimeout(resolve, ms)),
}) {
  let running = null
  let queued = false

  const drain = async () => {
    let ok = true
    let retry = 0
    do {
      queued = false
      if (!isEnabled()) return false

      const snapshot = getState()
      const sentTs = snapshot?._ts || 0
      try {
        await send(snapshot)
      } catch (error) {
        markDirty(error)
        ok = false
        if (isEnabled() && retry < retryDelays.length && shouldRetry(error)) {
          await wait(retryDelays[retry++])
          queued = true
          continue
        }
        break
      }

      retry = 0
      ok = true

      if ((getState()?._ts || 0) === sentTs) markClean()
      else {
        markDirty()
        queued = true
      }
    } while (queued)
    return ok
  }

  return function pushLatest() {
    queued = true
    if (!running) running = drain().finally(() => { running = null })
    return running
  }
}
