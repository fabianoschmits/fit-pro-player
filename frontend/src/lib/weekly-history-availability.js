// Readiness is evidence from the history domain, never network connectivity or
// the write queue's "saved" state. Evidence is account scoped and session local.
export function weeklyHistoryAvailability({ ready = false, scope = undefined, accountId = null, authLoading = false, online = true, workouts = [], history = undefined } = {}) {
  const scopeMatches = !authLoading && (accountId ? scope?.kind === 'account' && scope.userId === accountId : scope?.kind === 'anonymous')
  const hasLocalHistory = scopeMatches && ready && workouts.length > 0
  const restored = scopeMatches && ready
  const guest = restored && !accountId
  const evidence = restored && history?.accountId === accountId
  const historyComplete = guest || Boolean(evidence && history.complete === true)
  const updating = restored && !guest && (!evidence || ['idle', 'loading'].includes(history.state)) && online
  const failed = evidence && history.state === 'error'
  const status = !restored ? 'loading' : failed ? 'error' : historyComplete ? 'ready' : updating && !hasLocalHistory ? 'loading' : 'partial'
  return { status, historyComplete, hasLocalHistory, scopeMatches, updating,
    canConfirmPersonalRecords: historyComplete, canComparePeriods: historyComplete || Boolean(evidence && history.periodsComplete === true),
    canShowEmpty: historyComplete, unavailable: restored && !online && !hasLocalHistory && !historyComplete }
}
