import { describe, expect, it } from 'vitest'
import { ASSOCIATION_CASE, ASSOCIATION_CHOICE, applyAssociationChoice, classifyAssociation } from './account-association.js'

const empty = { routines: [] }
const anonymous = { onboardingDone: true, routines: [{ id: 'local' }] }
const account = { onboardingDone: true, routines: [{ id: 'account' }] }
const remote = { revision: 4, payload: { onboardingDone: true, routines: [{ id: 'cloud' }] } }

describe('account association decisions', () => {
  it('requires an explicit choice for anonymous-only, cloud-only and divergent data', () => {
    expect(classifyAssociation({ anonymousState: anonymous, accountState: empty }).case).toBe(ASSOCIATION_CASE.ANONYMOUS_ONLY)
    expect(classifyAssociation({ anonymousState: empty, accountState: empty, remoteSnapshot: remote }).case).toBe(ASSOCIATION_CASE.CLOUD_ONLY)
    expect(classifyAssociation({ anonymousState: anonymous, accountState: account, remoteSnapshot: remote, accountRevision: 3 }).case).toBe(ASSOCIATION_CASE.CONFLICT)
  })

  it('does not prompt for an empty account or an already synchronized account', () => {
    expect(classifyAssociation({ anonymousState: empty, accountState: empty }).requiresDecision).toBe(false)
    expect(classifyAssociation({ anonymousState: empty, accountState: account, remoteSnapshot: remote, accountRevision: 4 }).case).toBe(ASSOCIATION_CASE.SAME)
  })

  it('makes use-device, use-cloud and keep-separate explicit and non-destructive', () => {
    expect(applyAssociationChoice(ASSOCIATION_CHOICE.USE_DEVICE, { anonymousState: anonymous, accountState: empty })).toMatchObject({ kind: 'use-device', upload: true, expectedRevision: 0 })
    expect(applyAssociationChoice(ASSOCIATION_CHOICE.USE_CLOUD, { accountState: account, remoteSnapshot: remote })).toMatchObject({ kind: 'use-cloud', state: remote.payload, upload: false })
    expect(applyAssociationChoice(ASSOCIATION_CHOICE.KEEP_SEPARATE, { anonymousState: anonymous, accountState: account, remoteSnapshot: remote })).toMatchObject({ kind: 'keep-separate', state: account, upload: false })
  })
})
