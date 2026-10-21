import { describe, expect, it } from 'vitest'
import { createDemoSession, demoReducer, getDemoModel } from './session.js'

const send = (state, type, now, extra = {}) => demoReducer(state, { type, now, ...extra })
const start = (state, now = 0) => send(send(state, 'PRIMARY', now), 'PRIMARY', now + 3000)

describe('local workout player session', () => {
  it('announces preparation before execution and records a single result before resting', () => {
    let state = send(createDemoSession(), 'PRIMARY', 1000)
    expect(getDemoModel(state).phase).toBe('countdown')
    expect(getDemoModel(state).remaining).toBe(3)
    state = send(state, 'TICK', 4000)
    expect(getDemoModel(state).phaseTitle).toBe('Execute agora')
    state = send(state, 'PRIMARY', 9000)
    expect(getDemoModel(state)).toMatchObject({ phase: 'rest', completedTotal: 1, remaining: 15 })
    expect(state.results[0]).toMatchObject({ exerciseId: 'pullup', setNumber: 1, reps: 10, durationSeconds: 5 })
    state = send(state, 'PRIMARY', 9500)
    expect(getDemoModel(state)).toMatchObject({ phase: 'ready', setIndex: 1, completedTotal: 1 })
  })

  it('expires rest exactly once and keeps total workout and set clocks distinct', () => {
    let state = start(createDemoSession(), 1000)
    state = send(state, 'PRIMARY', 9000)
    state = send(state, 'TICK', 25000)
    expect(getDemoModel(state)).toMatchObject({ phase: 'ready', elapsedLabel: '0:24', completedTotal: 1 })
    state = send(state, 'TICK', 26000)
    expect(state.results).toHaveLength(1)
    expect(getDemoModel(state).setIndex).toBe(1)
  })

  it('completes all exercises and freezes the summary clock', () => {
    let state = createDemoSession(), now = 1000
    for (let ex = 0; ex < 3; ex++) {
      const count = [3, 2, 1][ex]
      for (let set = 0; set < count; set++) {
        state = start(state, now)
        state = send(state, 'PRIMARY', now + 8000)
        if (set < count - 1) state = send(state, 'PRIMARY', now + 9000)
        now += 10000
      }
      expect(state.phase).toBe('exerciseDone')
      state = send(state, 'PRIMARY', now)
    }
    expect(getDemoModel(state)).toMatchObject({ phase: 'complete', completedTotal: 6, progress: 1 })
    const clock = getDemoModel(state).elapsedLabel
    expect(getDemoModel(send(state, 'TICK', 999999)).elapsedLabel).toBe(clock)
  })

  it('does not let exercise navigation register or interrupt a live series', () => {
    const state = start(createDemoSession())
    expect(send(state, 'CHOOSE_EXERCISE', 5000, { index: 1 })).toBe(state)
    expect(send(state, 'CHOOSE_EXERCISE', 5000, { index: -1 })).toBe(state)
    expect(state.results).toEqual([])
  })

  it('clamps adjustments and ignores malformed values and unsupported fields', () => {
    let state = createDemoSession()
    state = send(state, 'ADJUST', 0, { field: 'reps', delta: -500 })
    state = send(state, 'ADJUST', 0, { field: 'rir', delta: 999 })
    expect(getDemoModel(state)).toMatchObject({ reps: 1, rir: 5 })
    expect(send(state, 'ADJUST', 0, { field: 'reps', delta: NaN })).toBe(state)
    expect(send(state, 'ADJUST', 0, { field: 'phase', delta: 1 })).toBe(state)
  })

  it('finishes a timed exercise automatically and does not double log repeated ticks', () => {
    let state = send(createDemoSession(), 'CHOOSE_EXERCISE', 0, { index: 2 })
    state = start(state, 1000)
    state = send(state, 'TICK', 24000)
    expect(state.phase).toBe('exerciseDone')
    expect(state.results).toHaveLength(1)
    expect(state.results[0]).toMatchObject({ exerciseId: 'hold', reps: 20 })
    expect(send(state, 'TICK', 25000).results).toHaveLength(1)
  })

  it('creates coherent scenario previews and resets without touching persisted storage', () => {
    let state = send(createDemoSession(), 'SET_PHASE', 1000, { phase: 'complete' })
    expect(getDemoModel(state)).toMatchObject({ completedTotal: 6, phase: 'complete' })
    state = send(state, 'RESET', 2000)
    expect(getDemoModel(state)).toMatchObject({ phase: 'ready', completedTotal: 0, elapsedLabel: '0:00' })
    expect(state.results).toEqual([])
  })

  it('records performed seconds when a timed series is ended before its target', () => {
    let state = send(createDemoSession(), 'CHOOSE_EXERCISE', 0, { index: 2 })
    state = start(state, 1000)
    state = send(state, 'PRIMARY', 9000)
    expect(state.results[0]).toMatchObject({ reps: 5, durationSeconds: 5, unit: 's' })
  })

  it('keeps elapsed time monotonic when an active duration is shortened below elapsed', () => {
    let state = send(createDemoSession(), 'CHOOSE_EXERCISE', 0, { index: 2 })
    state = start(state, 1000)
    state = send(state, 'TICK', 14000)
    state = send(state, 'ADJUST', 14000, { field: 'reps', delta: -15 })
    state = send(state, 'TICK', 14250)
    expect(getDemoModel(state).elapsedLabel).toBe('0:13')
    expect(state.results[0]).toMatchObject({ reps: 10, durationSeconds: 10 })
  })

  it('gives preview stages their own instructions and a coherent total duration', () => {
    const rest = send(createDemoSession(), 'SET_PHASE', 100000, { phase: 'rest' })
    expect(getDemoModel(rest).phaseHint).toContain('recupere')
    const done = send(createDemoSession(), 'SET_PHASE', 100000, { phase: 'exerciseDone' })
    expect(getDemoModel(done).phaseHint).toContain('registradas')
    const summary = send(createDemoSession(), 'SET_PHASE', 200000, { phase: 'complete' })
    expect(getDemoModel(summary).elapsedLabel).toBe('2:20')
  })

  it('extends or shortens a live rest in fifteen-second steps without changing results', () => {
    let state = send(start(createDemoSession(), 1000), 'PRIMARY', 9000)
    state = send(state, 'ADJUST', 9000, { field: 'rest', delta: 15 })
    expect(getDemoModel(state)).toMatchObject({ phase: 'rest', remaining: 30, restDuration: 30, completedTotal: 1 })
    state = send(state, 'ADJUST', 9000, { field: 'rest', delta: -15 })
    expect(getDemoModel(state).remaining).toBe(15)
    state = send(state, 'ADJUST', 9000, { field: 'rest', delta: -15 })
    expect(getDemoModel(state)).toMatchObject({ phase: 'ready', completedTotal: 1 })
  })

  it('does not turn a delayed preparation tick into extra performed seconds', () => {
    let state = send(createDemoSession(), 'CHOOSE_EXERCISE', 0, { index: 2 })
    state = send(state, 'PRIMARY', 1000)
    state = send(state, 'TICK', 61000)
    state = send(state, 'TICK', 61250)
    expect(state.results[0]).toMatchObject({ reps: 20, durationSeconds: 20 })
  })
})
