export const ASSOCIATION_CASE = Object.freeze({
  ANONYMOUS_ONLY: 'ANONYMOUS_ONLY',
  ACCOUNT_ONLY: 'ACCOUNT_ONLY',
  CLOUD_ONLY: 'CLOUD_ONLY',
  SAME: 'SAME',
  CONFLICT: 'CONFLICT',
  EMPTY: 'EMPTY',
})

export const ASSOCIATION_CHOICE = Object.freeze({
  USE_DEVICE: 'use-device',
  USE_CLOUD: 'use-cloud',
  KEEP_SEPARATE: 'keep-separate',
  CANCEL: 'cancel',
})

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}

export function hasRelevantLocalState(state) {
  const value = object(state)
  return Boolean(value.onboardingDone || value.active || value.profile?.name
    || value.workouts?.length || value.bodyweight?.length || value.bodyMeasurements?.length
    || value.customEx?.length || value.routines?.some(routine => !routine?.starter))
}

export function classifyAssociation({ anonymousState, accountState, remoteSnapshot, accountRevision = 0 } = {}) {
  const anonymous = hasRelevantLocalState(anonymousState)
  const account = hasRelevantLocalState(accountState)
  const cloud = Boolean(remoteSnapshot)
  if (anonymous && !account && !cloud) return { case: ASSOCIATION_CASE.ANONYMOUS_ONLY, requiresDecision: true }
  if (!anonymous && account && !cloud) return { case: ASSOCIATION_CASE.ACCOUNT_ONLY, requiresDecision: false }
  if (!anonymous && !account && cloud) return { case: ASSOCIATION_CASE.CLOUD_ONLY, requiresDecision: true }
  if (!anonymous && !account && !cloud) return { case: ASSOCIATION_CASE.EMPTY, requiresDecision: false }
  if (cloud && accountRevision === remoteSnapshot.revision && !anonymous) {
    return { case: ASSOCIATION_CASE.SAME, requiresDecision: false }
  }
  return { case: ASSOCIATION_CASE.CONFLICT, requiresDecision: true }
}

export function canAutoAdoptAnonymous({ anonymousState, accountState, remoteSnapshot } = {}) {
  return classifyAssociation({ anonymousState, accountState, remoteSnapshot }).case === ASSOCIATION_CASE.ANONYMOUS_ONLY
}

export function applyAssociationChoice(choice, { anonymousState, accountState, remoteSnapshot } = {}) {
  if (choice === ASSOCIATION_CHOICE.CANCEL || choice === ASSOCIATION_CHOICE.KEEP_SEPARATE) {
    return { kind: 'keep-separate', state: accountState, upload: false }
  }
  if (choice === ASSOCIATION_CHOICE.USE_DEVICE) {
    if (!hasRelevantLocalState(anonymousState)) return { kind: 'invalid', reason: 'anonymous-state-absent' }
    return { kind: 'use-device', state: anonymousState, upload: true, expectedRevision: remoteSnapshot?.revision || 0 }
  }
  if (choice === ASSOCIATION_CHOICE.USE_CLOUD) {
    if (!remoteSnapshot?.payload) return { kind: 'invalid', reason: 'remote-state-absent' }
    return { kind: 'use-cloud', state: remoteSnapshot.payload, upload: false, expectedRevision: remoteSnapshot.revision }
  }
  return { kind: 'invalid', reason: 'unknown-choice' }
}
