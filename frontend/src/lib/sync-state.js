// Serializes state uploads and coalesces changes made while a request is in flight.
// This prevents a slower, older request from landing after a newer one and rolling
// the server back. The latest snapshot is always sent before the queue is marked clean.
export function nextStateTimestamp(previous, now = Date.now()) {
  return Math.max(now, (Number(previous) || 0) + 1)
}

export function createStatePushQueue({ getState, isEnabled, send, markDirty, markClean }) {
  let running = null
  let queued = false

  const drain = async () => {
    let ok = true
    do {
      queued = false
      if (!isEnabled()) break

      const snapshot = getState()
      const sentTs = snapshot?._ts || 0
      try {
        await send(snapshot)
      } catch {
        markDirty()
        ok = false
        break
      }

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
