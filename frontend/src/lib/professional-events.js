// Events live in the account-scoped snapshot, alongside the active workout. A response
// may only acknowledge the same local scope that dispatched it.
const flushing = new WeakMap()
export function enqueueProfessionalEvent(state, event) {
  if (!event.accountId || !event.executionId) return
  const events = Array.isArray(state.pendingProfessionalEvents) ? state.pendingProfessionalEvents : []
  const id = `${event.executionId}:${event.type}`
  if (events.some(item => item.id === id && item.accountId === event.accountId)) return
  state.pendingProfessionalEvents = [...events, { ...event, id, occurredAt: event.occurredAt || new Date().toISOString(), payload: structuredClone(event.payload || {}) }]
}

export function flushProfessionalEvents({ client, store, userId } = {}) {
  if (!client?.rpc || !store?.getState || !userId) return Promise.resolve({ pending: 0 })
  const scope = store.getState().getActiveLocalScope?.()
  if (scope?.userId !== userId) return Promise.resolve({ skipped: true })
  if (flushing.get(store)?.scope === scope) return flushing.get(store).request
  const sameScope = () => store.getState().getActiveLocalScope?.() === scope
  const request = (async () => {
    let sent = 0
    while (sameScope()) {
      const event = (store.getState().S.pendingProfessionalEvents || []).find(item => item.accountId === userId && !item.blocked)
      if (!event) break
      const args = { p_execution_id: event.executionId, p_payload: event.payload }
      let name
      if (event.type === 'start') { name = 'start_workout_execution'; Object.assign(args, { p_assignment_id: event.assignmentId, p_day_key: event.dayKey, p_started_at: event.occurredAt }) }
      else { name = event.type === 'complete' ? 'complete_workout_execution' : 'abandon_workout_execution'; args.p_completed_at = event.occurredAt }
      try {
        const response = await client.rpc(name, args)
        if (response?.error) throw response.error
        if (!sameScope()) break
        store.getState().update(s => { s.pendingProfessionalEvents = (s.pendingProfessionalEvents || []).filter(item => item.id !== event.id || item.accountId !== userId) })
        sent++
      } catch (error) {
        const code = String(error?.code || 'network-unavailable').slice(0, 80)
        const blocked = ['42501', '22023', '23503'].includes(code)
        if (sameScope() && (event.lastError !== code || Boolean(event.blocked) !== blocked)) store.getState().update(s => {
          for (const pending of s.pendingProfessionalEvents || []) {
            if (pending.accountId === userId && (pending.id === event.id || (blocked && event.type === 'start' && pending.executionId === event.executionId))) { pending.lastError = code; pending.blocked = blocked }
          }
        })
        if (blocked) continue
        break
      }
    }
    return { sent, pending: sameScope() ? (store.getState().S.pendingProfessionalEvents || []).length : 0 }
  })().finally(() => { if (flushing.get(store)?.request === request) flushing.delete(store) })
  flushing.set(store, { scope, request })
  return request
}
