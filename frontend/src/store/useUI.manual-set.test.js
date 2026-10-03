// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from './useStore.js'
import { useUI } from './useUI.js'

const clone = value => JSON.parse(JSON.stringify(value))
const sessionId = 'manual-test:1000'
const runningSet = { sessionId, entryIdx: 0, setIdx: 0, exerciseId: 'bench' }

function workout() {
  const S = clone(DEF)
  S.sound = false
  S.active = {
    id: 'manual-test', start: 1000, cur: 0,
    entries: [
      { id: 'bench', target: { mode: 'reps' }, sets: [{ w: 60, r: 8, done: false }, { w: 60, r: 8, done: false }] },
      { id: 'row', target: { mode: 'reps' }, sets: [{ w: 40, r: 10, done: false }] },
    ],
  }
  useStore.setState({ S, user: null })
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  useUI.getState().stopRest(false)
  useUI.getState().stopWork()
  useUI.setState({ manualSet: null, sheets: [], toastMsg: '' })
  workout()
})

afterEach(() => {
  useUI.getState().stopRest(false)
  useUI.getState().stopWork()
  useUI.setState({ manualSet: null })
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('manual set execution state', () => {
  it('stopping a timed set records elapsed time and ends work before its completion callback', () => {
    let phaseAtCompletion
    const onDone = vi.fn(() => { phaseAtCompletion = useUI.getState().work.phase })
    useUI.getState().startWork(45, 'Hold', onDone)
    vi.advanceTimersByTime(12_000)
    useUI.getState().finishWorkEarly()
    expect(onDone).toHaveBeenCalledWith(12)
    expect(phaseAtCompletion).toBe('done')
    expect(useUI.getState().work.phase).toBe('done')
    vi.advanceTimersByTime(60_000)
    expect(onDone).toHaveBeenCalledTimes(1)
  })
  it('starts only the requested pending set without completing or persisting it', () => {
    const before = clone(useStore.getState().S)

    expect(useUI.getState().startManualSet?.(sessionId, 1, 0)).toBe(true)

    expect(useUI.getState().manualSet).toEqual({ sessionId, entryIdx: 1, setIdx: 0, exerciseId: 'row' })
    expect(useStore.getState().S).toEqual(before)
    expect(localStorage.length).toBe(0)
    vi.advanceTimersByTime(120_000)
    expect(useUI.getState().manualSet?.exerciseId).toBe('row')
    expect(useStore.getState().S.active.entries[1].sets[0].done).toBe(false)
  })

  it.each([
    ['wrong session', 'other:1000', 0, 0],
    ['old start time', 'manual-test:999', 0, 0],
    ['negative entry', sessionId, -1, 0],
    ['missing entry', sessionId, 2, 0],
    ['fractional entry', sessionId, 0.5, 0],
    ['string entry', sessionId, '0', 0],
    ['negative set', sessionId, 0, -1],
    ['missing set', sessionId, 0, 2],
    ['fractional set', sessionId, 0, 0.5],
    ['string set', sessionId, 0, '0'],
  ])('rejects a %s', (_name, requestedSession, entryIdx, setIdx) => {
    expect(useUI.getState().startManualSet?.(requestedSession, entryIdx, setIdx)).toBe(false)
    expect(useUI.getState().manualSet).toBeNull()
  })

  it('rejects a workout that has not started', () => {
    useStore.getState().S.active.start = null

    expect(useUI.getState().startManualSet?.('manual-test:null', 0, 0)).toBe(false)
    expect(useUI.getState().manualSet).toBeNull()
  })

  it('rejects a missing workout', () => {
    useStore.setState({ S: { ...useStore.getState().S, active: null } })

    expect(useUI.getState().startManualSet?.(sessionId, 0, 0)).toBe(false)
    expect(useUI.getState().manualSet).toBeNull()
  })

  it('rejects a completed row', () => {
    useStore.getState().S.active.entries[0].sets[0].done = true

    expect(useUI.getState().startManualSet?.(sessionId, 0, 0)).toBe(false)
    expect(useUI.getState().manualSet).toBeNull()
  })

  it('rejects another set while a manual set is executing', () => {
    useUI.setState({ manualSet: runningSet })

    expect(useUI.getState().startManualSet?.(sessionId, 0, 1)).toBe(false)
    expect(useUI.getState().manualSet).toEqual(runningSet)
  })

  it('rejects manual execution during rest', () => {
    useUI.getState().startRest(90)

    expect(useUI.getState().startManualSet?.(sessionId, 0, 0)).toBe(false)
    expect(useUI.getState().timer.left).toBe(90)
    expect(useUI.getState().manualSet).toBeNull()
  })

  it.each(['work', 'rest'])('rejects manual execution during timed %s', phase => {
    useUI.getState().startWork(30, 'Hold')
    if (phase === 'rest') useUI.getState().startRest(90)

    expect(useUI.getState().startManualSet?.(sessionId, 0, 0)).toBe(false)
    expect(useUI.getState().work.phase).toBe(phase)
    expect(useUI.getState().manualSet).toBeNull()
  })

  it('dismisses a finished timed overlay when starting manual execution', () => {
    useUI.getState().startWork(1, 'Hold')
    vi.advanceTimersByTime(1000)
    expect(useUI.getState().work.phase).toBe('done')

    expect(useUI.getState().startManualSet?.(sessionId, 0, 0)).toBe(true)

    expect(useUI.getState().work).toBeNull()
    expect(useUI.getState().manualSet).toEqual(runningSet)
  })

  it('replaces execution state belonging to an earlier session', () => {
    useUI.setState({ manualSet: { ...runningSet, sessionId: 'manual-test:999' } })

    expect(useUI.getState().startManualSet?.(sessionId, 0, 1)).toBe(true)
    expect(useUI.getState().manualSet).toEqual({ ...runningSet, setIdx: 1 })
  })

  it('replaces execution state whose exercise was removed', () => {
    useUI.setState({ manualSet: { ...runningSet, exerciseId: 'removed-exercise' } })

    expect(useUI.getState().startManualSet?.(sessionId, 1, 0)).toBe(true)
    expect(useUI.getState().manualSet?.exerciseId).toBe('row')
  })

  it('stopping manual execution leaves the training log and rest untouched', () => {
    useUI.setState({ manualSet: runningSet })
    useUI.getState().startRest(90)
    useUI.setState({ manualSet: runningSet })
    const before = clone(useStore.getState().S)

    useUI.getState().stopManualSet?.()

    expect(useUI.getState().manualSet).toBeNull()
    expect(useUI.getState().timer.left).toBe(90)
    expect(useStore.getState().S).toEqual(before)
  })

  it('starting rest clears manual execution and finishing rest waits for another Play', () => {
    useUI.setState({ manualSet: runningSet })

    useUI.getState().startRest(2)

    expect(useUI.getState().manualSet).toBeNull()
    vi.advanceTimersByTime(2000)
    expect(useUI.getState().timer).toBeNull()
    expect(useUI.getState().manualSet).toBeNull()
    expect(useStore.getState().S.active.entries[0].sets.map(set => set.done)).toEqual([false, false])
    expect(useUI.getState().startManualSet?.(sessionId, 0, 1)).toBe(true)
  })

  it('clears manual execution even when rest has no duration', () => {
    useUI.setState({ manualSet: runningSet })

    useUI.getState().startRest(0)

    expect(useUI.getState().manualSet).toBeNull()
    expect(useUI.getState().timer).toBeNull()
  })

  it('starting a timed set clears stale manual execution', () => {
    useUI.setState({ manualSet: { ...runningSet, sessionId: 'previous-workout:500' } })

    useUI.getState().startWork(30, 'Hold')

    expect(useUI.getState().manualSet).toBeNull()
    expect(useUI.getState().work.phase).toBe('work')
    expect(useUI.getState().work.left).toBe(30)
  })

  it.each(['expires', 'is skipped'])('returns to ready when timed rest %s after a completed hold', restAction => {
    let restCompleted = 0
    useUI.getState().startWork(2, 'Hold', elapsed => {
      const row = useStore.getState().S.active.entries[0].sets[0]
      row.sec = elapsed
      row.done = true
      useUI.getState().startRest(3, () => { restCompleted++ })
    }, { entryIdx: 0, setIdx: 0, onNext: () => useUI.getState().startWork(30, 'Next hold') })
    vi.advanceTimersByTime(2000)
    expect(useUI.getState().work.phase).toBe('rest')
    expect(useUI.getState().work.restLeft).toBe(3)
    expect(useStore.getState().S.active.entries[0].sets[0]).toMatchObject({ sec: 2, done: true })

    expect(() => {
      if (restAction === 'expires') vi.advanceTimersByTime(3000)
      else useUI.getState().skipWorkRest()
    }).not.toThrow()

    expect(useUI.getState().work).toBeNull()
    expect(useUI.getState().timer).toBeNull()
    expect(useUI.getState().manualSet).toBeNull()
    expect(restCompleted).toBe(1)
    vi.advanceTimersByTime(60_000)
    expect(useUI.getState().work).toBeNull()
    expect(useUI.getState().manualSet).toBeNull()
    expect(restCompleted).toBe(1)
    expect(useStore.getState().S.active.entries[0].sets.map(set => set.done)).toEqual([true, false])
  })
})
