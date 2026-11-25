import { describe, expect, it } from 'vitest'
import { weeklyHistoryAvailability } from './weekly-history-availability.js'

const account = { kind: 'account', userId: 'a' }
const base = { ready: true, scope: account, accountId: 'a', online: true, workouts: [], history: { accountId: 'a', state: 'loading', complete: false } }
describe('weekly history evidence', () => {
  it('does not equate restored state with loaded account history', () => {
    expect(weeklyHistoryAvailability(base)).toMatchObject({ status: 'loading', historyComplete: false, canComparePeriods: false })
  })
  it('preserves local data during refresh without confirming records', () => {
    expect(weeklyHistoryAvailability({ ...base, workouts: [{ id: 'local' }] })).toMatchObject({ status: 'partial', hasLocalHistory: true, canConfirmPersonalRecords: false })
  })
  it('accepts evidence from a successful uncapped account read, including offline', () => {
    for (const online of [true, false]) expect(weeklyHistoryAvailability({ ...base, online, history: { accountId: 'a', state: 'ready', complete: true } })).toMatchObject({ status: 'ready', historyComplete: true, canComparePeriods: true })
  })
  it('never accepts evidence or data from a different account', () => {
    expect(weeklyHistoryAvailability({ ...base, accountId: 'b', workouts: [{ id: 'private' }] })).toMatchObject({ status: 'loading', hasLocalHistory: false, historyComplete: false, scopeMatches: false })
  })
  it('distinguishes a restored visitor from an unproven account', () => {
    expect(weeklyHistoryAvailability({ ...base, scope: { kind: 'anonymous', userId: null }, accountId: null })).toMatchObject({ historyComplete: true })
    expect(weeklyHistoryAvailability({ ...base, history: null })).toMatchObject({ historyComplete: false })
  })
  it.each([true, false])('preserves error and offline absence with local history=%s', hasLocal => {
    const workouts = hasLocal ? [{ id: 'local' }] : []
    expect(weeklyHistoryAvailability({ ...base, workouts, history: { accountId: 'a', state: 'error', complete: false } }).status).toBe('error')
    expect(weeklyHistoryAvailability({ ...base, workouts, online: false }).status).toBe('partial')
  })
  it('does not trust truncated reads or a store that is still restoring', () => {
    expect(weeklyHistoryAvailability({ ...base, history: { accountId: 'a', state: 'ready', complete: false } }).historyComplete).toBe(false)
    expect(weeklyHistoryAvailability({ ...base, ready: false }).status).toBe('loading')
  })
  it('permits independently proven period coverage without claiming all-time records', () => {
    expect(weeklyHistoryAvailability({ ...base, history: { accountId: 'a', state: 'ready', complete: false, periodsComplete: true } })).toMatchObject({ canComparePeriods: true, canConfirmPersonalRecords: false })
  })
})
