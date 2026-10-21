import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr, exerciseName } from '../lib/exercises.js'
import { effectiveRoutine, lastEntryFor, buildSets, freestyleConfig, defaultConfig, setsDoneActive, supersetUnits, unitOf, modeOf, isBw, cascadeWeight, insertWarmupRow, removeRowAt, pairAdjacent, unpairSuperset, cleanupSg } from '../lib/history.js'
import { todayISO, exCount, DAYN, routineId } from '../lib/format.js'
import { beep, vibrate } from '../lib/sound.js'
import { t } from '../lib/i18n.js'
import { setProgressHighWater, supersetFlowStep } from '../lib/supersetFlow.js'
import WorkoutExercisePlayer from '../components/WorkoutExercisePlayer.jsx'
import '../workout-player.css'
import { startFlow, exercisePicker, exConfigSheet, topWeightSheet, finishWorkout, workoutCompleteSheet, confirmSheet, abandonWorkout } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import RoutineMuscleThumb from '../components/RoutineMuscleThumb.jsx'
import { Button } from '../components/ui.jsx'
import { nextPrescription, applyPrescription } from '../lib/progression.js'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { routineName } from '../lib/starter.js'
import { isWarmupRow } from '../lib/workout-model.js'
import { applyPreviousSetValues, replaceSessionExercise } from '../lib/workout-session.js'

/* ---------- start chooser (no active workout) ---------- */
function StartChooser() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const today = todayISO()
  const scheduledToday = effectiveRoutine(S, today)
  const todayR = scheduledToday?.ex.length ? scheduledToday : null
  const emptyToday = scheduledToday && !scheduledToday.ex.length ? scheduledToday : null
  const todayOvr = S.dayPlan[today] !== undefined
  const restDay = !scheduledToday
  const completedToday = todayR ? [...S.workouts].reverse().find(workout => workout.d === today && workout.routineId === todayR.id) : null
  const availableRoutines = S.routines.filter(r => r.ex.length && (restDay || r !== todayR))
  const createTodayPlan = () => {
    const r = { id: routineId(), name: t("Today's plan"), emoji: DEFAULT_GLYPH, ex: [] }
    update(state => {
      state.routines.push(r)
      state.dayPlan[today] = r.id
    })
    nav('/plan/r/' + r.id)
  }
  return <div className="narrow">
    <div className="hdr"><div><h1>{t('Start workout')}</h1><div className="sub">{t(DAYN[new Date().getDay()])} — {scheduledToday ? t('today is {0}', routineName(scheduledToday)) : t('rest day, but no one’s stopping you')}</div></div></div>
    {completedToday && <div className="card" style={{ borderColor: 'var(--acc)' }}>
      <h2 className="accent">{t(completedToday.endedEarly ? 'Treino do dia encerrado mais cedo' : 'Treino do dia concluído')}</h2>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div><div className="big">{routineName(todayR)}</div><div className="muted small">{exCount(completedToday.entries?.length || 0)}</div></div>
        <span className="lrow-i" style={{ width: 38, height: 38 }}><RoutineMuscleThumb routine={todayR} body={S.body} /></span>
      </div>
      <Button variant="primary" icon="play" onClick={() => startFlow(null)}>{t('Start another workout')}</Button>
    </div>}
    {!completedToday && todayR && <div className="card" style={{ borderColor: 'var(--acc)' }}>
      <h2 className="accent">{t("Today's plan")}{todayOvr ? ' · ' + t('rescheduled') : ''}</h2>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div><div className="big">{routineName(todayR)}</div><div className="muted small">{exCount(todayR.ex.length)}</div></div>
        <span className="lrow-i" style={{ width: 38, height: 38 }}><RoutineMuscleThumb routine={todayR} body={S.body} /></span>
      </div>
      <Button variant="primary" icon="play" onClick={() => startFlow(todayR.id)}>{t('Start {0}', routineName(todayR))}</Button>
    </div>}
    {!completedToday && emptyToday && <div className="card">
      <h2>{t("Today's plan")}</h2>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div><div className="big">{routineName(emptyToday)}</div><div className="muted small">{exCount(0)}</div></div>
        <span className="lrow-i" style={{ width: 38, height: 38 }}><RoutineMuscleThumb routine={emptyToday} body={S.body} /></span>
      </div>
      <Button variant="primary" icon="plus" onClick={() => nav('/plan/r/' + emptyToday.id)}>{t('Add exercise')}</Button>
    </div>}
    {!restDay && !completedToday && availableRoutines.length > 0 && <><h4 className="sec">{t('Other routines')}</h4>
      <div className="list">{availableRoutines.map(r => <div key={r.id} className="item" onClick={() => startFlow(r.id)}>
        <span className="lrow-i"><RoutineMuscleThumb routine={r} body={S.body} /></span>
        <div className="grow"><div className="tt">{routineName(r)}</div><div className="ss">{exCount(r.ex.length)}</div></div>
        <span className="tag acc">{t('Start')}</span></div>)}</div></>}
    <div style={{ height: 14 }} />
    {restDay && <div className="card">
      <h2>{t('No workout scheduled today')}</h2>
      <div className="muted small" style={{ marginBottom: 12 }}>{t('Choose a workout for today or do a freestyle workout.')}</div>
      {availableRoutines.length > 0 && <><h4 className="sec">{t('Choose a workout for today')}</h4><div className="list">{availableRoutines.map(r => <div key={r.id} className="item" onClick={() => startFlow(r.id)}>
        <span className="lrow-i"><RoutineMuscleThumb routine={r} body={S.body} /></span>
        <div className="grow"><div className="tt">{routineName(r)}</div><div className="ss">{exCount(r.ex.length)}</div></div>
        <span className="tag acc">{t('Start')}</span>
      </div>)}</div><div style={{ height: 12 }} /></>}
      <Button icon="shuffle" onClick={() => startFlow(null)}>{t('Freestyle workout (pick as you go)')}</Button>
      <div style={{ height: 8 }} />
      <Button variant="primary" icon="plus" onClick={createTodayPlan}>{t('Create a plan for today')}</Button>
    </div>}
    {!restDay && !completedToday && <Button icon="shuffle" onClick={() => startFlow(null)}>{t('Freestyle workout (pick as you go)')}</Button>}
    {!S.routines.some(r => r.ex.length) && <><div style={{ height: 10 }} /><Button variant="primary" onClick={() => nav('/plan')}>{t('Build a plan first')}</Button></>}
  </div>
}

/* ---------- elapsed clock (isolated so the workout tree doesn't re-render every second) ---------- */
function Elapsed({ active }) {
  const timer = useUI(s => s.timer)
  const work = useUI(s => s.work)
  const manualSet = useUI(s => s.manualSet)
  const [t, setT] = useState('0:00')
  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      let extra = 0
      if (manualSet?.startedAt) extra = now - manualSet.startedAt
      else if (timer?.startedAt) extra = Math.min(timer.total * 1000, now - timer.startedAt)
      else if (work?.phase === 'work' && work.startedAt) extra = Math.min(work.total * 1000, now - work.startedAt)
      else if (work?.phase === 'rest' && work.restStartedAt) extra = Math.min(work.restTotal * 1000, now - work.restStartedAt)
      const s = Math.max(0, Math.floor(((active.durationMs || 0) + extra) / 1000))
      setT(Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'))
    }
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv)
  }, [active.durationMs, manualSet?.startedAt, timer?.startedAt, work?.startedAt, work?.restStartedAt])
  return <span>{t}</span>
}

/* Optional edits stay together below the exercise, away from execution controls. */
function ExerciseAdjustments({ entryIdx, locked, onAddSet, onRemoveSet, onAddWarmup, onRemoveSetAt, onUseLast, onReplace, onPairPrev, onPairNext }) {
  const S = useStore(s => s.S)
  const entry = S.active?.entries[entryIdx]
  if (!entry) return null
  const allDone = entry.sets.length > 0 && entry.sets.every(set => set.done)
  const hasPrevious = !!lastEntryFor(S, entry.id)
  const warmups = entry.sets.map((set, idx) => ({ set, idx })).filter(({ set }) => isWarmupRow(set))
  return <section className="workout-tool-group" data-exidx={entryIdx}>
    <h3>{exerciseName(exOr(entry.id))}</h3>
    <div className="workout-tool-actions">
      {!allDone && <>
        <Button size="sm" variant="ghost" icon="plus" disabled={locked} onClick={onAddSet}>{t('Add set')}</Button>
        <Button size="sm" variant="ghost" icon="flame" className="workout-warmup-action" disabled={locked} onClick={onAddWarmup}>{t('Add warm-up set')}</Button>
        <Button size="sm" variant="ghost" icon="minus" className="workout-danger-action" disabled={locked || entry.sets.length <= 1} onClick={onRemoveSet}>{t('Remove set')}</Button>
      </>}
      {hasPrevious && <Button size="sm" variant="ghost" icon="reset" className="workout-history-action" disabled={locked} onClick={onUseLast}>{t('Use last values')}</Button>}
      <Button size="sm" variant="ghost" icon="shuffle" disabled={locked} onClick={onReplace}>{t('Replace')}</Button>
      {onPairPrev && <Button size="sm" variant="ghost" icon="link" disabled={locked} onClick={onPairPrev}>{t('Make superset with previous')}</Button>}
      {onPairNext && <Button size="sm" variant="ghost" icon="link" disabled={locked} onClick={onPairNext}>{t('Make superset with next')}</Button>}
    </div>
    {!!warmups.length && <div className="workout-warmup-tools">
      {warmups.map(({ idx }, num) => <Button key={idx} size="sm" variant="ghost" icon="minus" className="workout-danger-action" data-setidx={idx}
        disabled={locked || entry.sets.length <= 1} onClick={() => onRemoveSetAt(idx)}>{t('Remove warm-up set {0}', num + 1)}</Button>)}
    </div>}
  </section>
}

/* ---------- active workout ---------- */
export function removeActiveExercise(idx) {
  // Clear the work callback before indexes can shift. This also protects a confirmation sheet
  // that was opened first and confirmed after a timed hold started.
  useUI.getState().stopWork()
  useUI.getState().stopManualSet()
  useStore.getState().update(s => {
    if (!s.active || !Array.isArray(s.active.entries)) return
    if (idx < 0 || idx >= s.active.entries.length) return
    s.active.entries.splice(idx, 1)
    cleanupSg(s.active.entries)
    if (idx < s.active.cur) s.active.cur--
    if (s.active.cur >= s.active.entries.length) s.active.cur = Math.max(0, s.active.entries.length - 1)
  }, true)
  const active = useStore.getState().S.active
  const queue = useStore.getState().queueSessionOperation
  if (active && queue) void queue({ kind: 'exercise_removed', payload: { active } })
}

function ActiveWorkout() {
  const update = useStore(s => s.update)
  useEffect(() => {
    update(state => { state.mediaSize = 'full' })
  }, [update])
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const { startRest, stopRest, work, manualSet, stopManualSet } = useUI()
  const A = S.active
  const units = supersetUnits(A.entries)
  const cur = Math.min(A.cur, Math.max(0, A.entries.length - 1))
  const unit = A.entries.length ? unitOf(units, cur) : []
  const unitIdx = units.findIndex(u => u === unit)
  const isSuperset = unit.length > 1
  const workoutStarted = !!A.start
  const adjustmentsLocked = !workoutStarted || !!manualSet || work?.phase === 'work'
  const navigationLocked = !workoutStarted || !!manualSet || work?.phase === 'work' || work?.phase === 'rest'
  const navigateExercise = index => {
    if (navigationLocked || index < 0 || index >= A.entries.length || index === cur) return
    if (work?.phase === 'done') useUI.getState().stopWork()
    update(s => { if (s.active) s.active.cur = index })
  }
  useEffect(() => {
    if (!manualSet) return
    const entry = A.entries[manualSet.entryIdx]
    // Navigation and structural edits cancel execution rather than completing a different row.
    if (manualSet.sessionId !== `${A.id}:${A.start}` || manualSet.entryIdx !== cur
      || entry?.id !== manualSet.exerciseId || !entry?.sets[manualSet.setIdx] || entry.sets[manualSet.setIdx].done) stopManualSet()
  }, [A.id, A.start, A.entries, cur, manualSet, stopManualSet])
  const queueActive = (kind = 'set_upserted') => {
    const store = useStore.getState()
    const active = store.S.active
    if (active && store.queueSessionOperation) void store.queueSessionOperation({ kind, payload: { active } })
  }
  const startWorkout = () => {
    update(s => {
      if (s.active && !s.active.start) { s.active.start = Date.now(); s.active.durationMs = Math.max(0, Number(s.active.durationMs) || 0) }
    })
    queueActive()
  }
  // Superset flow: keep the active exercise in view - completing a set scrolls to the
  // next exercise in the group, then back up to the first exercise of the next round.
  const exRefs = useRef({})
  const progressHighWater = useRef(A.entries.map(e => e.sets.filter(s => s.done).length))
  // The marks are index-keyed, and removing an exercise shifts every index above it down
  // (removeActiveExercise splices). Re-baseline whenever the list length changes, otherwise a
  // shifted exercise inherits its predecessor's mark and its real progress reads as a re-check.
  useEffect(() => {
    progressHighWater.current = A.entries.map(e => e.sets.filter(s => s.done).length)
  }, [A.entries.length])
  useEffect(() => {
    if (!isSuperset) return
    const el = exRefs.current[cur]
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [cur, isSuperset, A.entries.length])

  const total = A.entries.reduce((n, e) => n + e.sets.length, 0)
  const done = setsDoneActive(A)
  const completedExercises = A.entries.filter(entry => entry.sets.length && entry.sets.every(set => set.done)).length
  const allExercisesDone = A.entries.length > 0 && completedExercises === A.entries.length
  const applySuggestedProgression = () => {
    update(s => {
      if (!s.active?.assignmentId || setsDoneActive(s.active)) return
      const routine = s.routines.find(item => item.id === s.active.routineId)
      s.active.entries.forEach(entry => {
        const plan = nextPrescription(s, { ...entry.target, id: entry.id }, routine)
        entry.plan = plan
        entry.sets = applyPrescription(entry.sets, plan)
      })
      s.active.progressionApplied = true
    })
    queueActive()
  }

  const mutEntry = (idx, fn) => {
    update(s => { fn(s.active.entries[idx]) }, true)
    queueActive()
  }
  // Clearing an optional field drops the key rather than storing null, so a set only carries
  // what was actually logged — in the session, in history and in a backup.
  const setField = (idx, i, field, v) => mutEntry(idx, e => {
    if (v == null) delete e.sets[i][field]; else e.sets[i][field] = v
    // Changing a weight cascades to the following sets of the same phase, so a
    // heavier bar carries through the set instead of retyping every row.
    if (field === 'w') {
      e.sets = cascadeWeight(e.sets, i, v)
    }
  })
  const modeAt = idx => modeOf({ ...(A.entries[idx].target || {}), id: A.entries[idx].id })
  const addSet = idx => mutEntry(idx, e => {
    const l = e.sets[e.sets.length - 1]
    const m = modeOf({ ...(e.target || {}), id: e.id })
    if (m === 'cardio') e.sets.push({ min: l ? l.min : (e.target.min || 20), speed: l ? l.speed : (e.target.speed || 8), done: false })
    else if (m === 'time') e.sets.push({ sec: l ? l.sec : (e.target.sec || 45), w: l ? (l.w || 0) : (e.target.weight || 0), done: false })
    else e.sets.push({ w: l ? l.w : 0, r: l ? l.r : e.target.reps, done: false })
  })
  const reshapeEntry = (idx, fn) => {
    useUI.getState().stopManualSet()
    useUI.getState().stopWork()
    mutEntry(idx, fn)
    const entry = useStore.getState().S.active?.entries[idx]
    if (entry) progressHighWater.current[idx] = entry.sets.filter(set => set.done).length
  }
  const removeSet = idx => reshapeEntry(idx, e => { if (e.sets.length > 1) e.sets.pop() })
  const addWarmup = idx => reshapeEntry(idx, e => {
    const m = modeOf({ ...(e.target || {}), id: e.id })
    e.sets = insertWarmupRow(e.sets, m, e.target || {})
  })
  const removeSetAt = (idx, i) => reshapeEntry(idx, e => { e.sets = removeRowAt(e.sets, i) })
  const pairAt = (first, second) => {
    update(s => { s.active.entries = pairAdjacent(s.active.entries, first, second) })
    queueActive()
  }
  const unpairAt = idx => {
    update(s => { s.active.entries = unpairSuperset(s.active.entries, idx) })
    queueActive()
  }
  const onPairPrev = !isSuperset && cur > 0 ? () => pairAt(cur - 1, cur) : null
  const onPairNext = !isSuperset && cur < A.entries.length - 1 ? () => pairAt(cur, cur + 1) : null

  const useLastValues = idx => {
    const current = useStore.getState().S.active?.entries?.[idx]
    if (!current) return
    const previous = lastEntryFor(useStore.getState().S, current.id)
    if (!previous) return
    const mode = modeOf({ ...(current.target || {}), id: current.id })
    mutEntry(idx, entry => { entry.sets = applyPreviousSetValues(entry.sets, previous.sets, mode) })
    useUI.getState().toast(t('Previous values applied'))
  }

  const addExerciseFlow = () => exercisePicker(ex => {
    const routine = S.routines.find(r => r.id === A.routineId)
    const freestyle = !A.routineId
    const seed = freestyle ? freestyleConfig(S, { id: ex.id, ...defaultConfig(ex.id) }) : null
    exConfigSheet(ex, null, cfg => {
      update(s => {
        const full = { ...cfg, id: ex.id }
        const plan = freestyle ? null : nextPrescription(s, full, s.routines.find(r => r.id === s.active.routineId))
        const sets = buildSets(s, full, freestyle ? { preferLast: true } : undefined)
        s.active.entries.push({ id: ex.id, target: { ...cfg }, plan, sets: freestyle ? sets : applyPrescription(sets, plan) })
        s.active.cur = s.active.entries.length - 1
      })
      queueActive('exercise_added')
    }, null, routine, seed)
  })

  const openReplacementPicker = idx => exercisePicker(ex => {
    const live = useStore.getState().S
    const previous = live.active?.entries?.[idx]
    if (!previous) return
    const workSets = (previous.sets || []).filter(set => !isWarmupRow(set))
    const remaining = workSets.filter(set => !set.done).length
    const seed = {
      ...freestyleConfig(live, { id: ex.id, ...defaultConfig(ex.id) }),
      sets: Math.max(1, remaining || workSets.length || 1),
    }
    exConfigSheet(ex, null, cfg => {
      useUI.getState().stopManualSet()
      useUI.getState().stopWork()
      let replaced = false
      update(s => {
        if (!s.active?.entries?.[idx]) return
        const full = { ...cfg, id: ex.id }
        const replacement = {
          id: ex.id,
          target: { ...cfg },
          plan: null,
          sets: buildSets(s, full, { preferLast: true }),
        }
        const result = replaceSessionExercise(s.active.entries, idx, replacement)
        s.active.entries = result.entries
        cleanupSg(s.active.entries)
        s.active.cur = result.replacementIndex
        replaced = true
      })
      if (replaced) useUI.getState().toast(t('Exercise replaced'))
      if (replaced) queueActive()
    }, null, null, seed, t('Replace'))
  }, { closeOnPick: true, title: t('Replace exercise'), excludeIds: [A.entries[idx]?.id].filter(Boolean) })

  const replaceExercise = idx => {
    if (A.entries[idx]) openReplacementPicker(idx)
  }

  // Remove a whole exercise from the session. The confirmation always asks first; in a
  // superset it asks WHICH exercise of the group to remove.
  const removeExercise = removeActiveExercise
  const confirmRemoveExercise = idx => {
    const e = A.entries[idx]
    if (!e) return
    const hasDone = (e.sets || []).some(s => s.done)
    confirmSheet({
      title: t('Remove {0}?', exOr(e.id).n),
      message: hasDone
        ? t('The sets you logged for this exercise in this session will be lost.')
        : t('This removes the exercise from your current session.'),
      confirmText: t('Remove'), danger: true, onConfirm: () => removeExercise(idx)
    })
  }
  const removeExerciseSheet = () => {
    if (unit.length > 1) {
      useUI.getState().openSheet(close => (
        <div>
          <h3>{t('Remove exercise')}</h3>
          <div className="muted small" style={{ marginBottom: 12 }}>{t('Which exercise in this superset do you want to remove?')}</div>
          <div className="list">
            {unit.map(idx => <div key={idx} className="item" onClick={() => { close(); confirmRemoveExercise(idx) }}>
              <div className="grow"><div className="tt">{exOr(A.entries[idx]?.id).n}</div></div>
              <Icon name="chevronRight" />
            </div>)}
          </div>
        </div>
      ))
    } else confirmRemoveExercise(cur)
  }

  // A timed set is held, not typed. The work timer records what was actually held — an early
  // finish logs 0:38 of a 0:45 target rather than crediting the full prescription — and then
  // checks the set off through the normal path, so rest, supersets and the finish prompt all
  // behave exactly as they do for a reps set.
  const startTimed = (idx, i) => {
    const e = A.entries[idx]
    const isLastSet = !e.sets.slice(i + 1).some(s => !s.done)
    useUI.getState().startWork(e.sets[i].sec || 45, exOr(e.id).n, elapsed => {
      mutEntry(idx, en => { en.sets[i].sec = elapsed })
      if (!useStore.getState().S.active.entries[idx].sets[i].done) toggle(idx, i)
    }, { entryIdx: idx, setIdx: i, isLastSet })
  }

  const toggle = (idx, i) => {
    const runningManualSet = useUI.getState().manualSet
    const completesManualSet = runningManualSet?.sessionId === `${A.id}:${A.start}` && runningManualSet.entryIdx === idx && runningManualSet.setIdx === i
    useUI.getState().stopManualSet(completesManualSet)
    const m = modeAt(idx)
    const cardioEntry = m === 'cardio'
    const isLastUnit = unitIdx >= units.length - 1
    let askTop = false, exJustDone = false, workoutDone = false, checked = false
    mutEntry(idx, e => {
      e.sets[i].done = !e.sets[i].done
      checked = e.sets[i].done
      if (e.sets[i].done) {
        beep(S.sound, 1040, 0.12); vibrate(30)
        const unitDone = unit.every(ui => (ui === idx ? e : A.entries[ui]).sets.every(x => x.done))
        if (unitDone && isLastUnit) workoutDone = true      // last exercise's last set → done
        // Only loaded reps training has a "working weight" worth confirming — a bodyweight
        // plank has nothing to put in that slider, and neither does a set of push-ups
        // (issue #32: the fewest taps that still record what happened).
        const loaded = m === 'reps' && !(isBw({ ...(e.target || {}), id: e.id }) && !e.sets.some(x => x.w > 0))
        if (e.sets.every(x => x.done)) { exJustDone = true; if (loaded && !e.asked) { e.asked = true; askTop = true } }
      }
    })
    const triggerFinishAction = () => {
      if (askTop) topWeightSheet(idx)
      else if (workoutDone) workoutCompleteSheet()
      else if (exJustDone && cardioEntry) useUI.getState().toast(t('Cardio logged'))
      else if (exJustDone && m === 'time') useUI.getState().toast(t('Hold logged'))
    }

    // Only progress beyond this exercise's high-water mark may navigate or change rest. This
    // prevents an uncheck/re-check of finished work from replaying the flow side effects.
    const fresh = useStore.getState().S.active
    if (fresh && checked && fresh.entries[idx]) {
      const progress = setProgressHighWater(fresh.entries[idx], progressHighWater.current[idx] || 0)
      progressHighWater.current[idx] = progress.highWater
      if (!progress.isNew) return

      const freshUnits = supersetUnits(fresh.entries)
      const freshUnit = freshUnits.find(u => u.includes(idx))
      const freshUnitIdx = freshUnits.indexOf(freshUnit)
      const freshLastUnit = freshUnitIdx >= freshUnits.length - 1
      const freshUnitDone = freshUnit?.every(ui => fresh.entries[ui].sets.every(x => x.done))
      const restSeconds = fresh.entries[idx].target?.rest ?? S.restSec

      // The final set ends the session immediately. A rest timer here obscures the finish action
      // and asks the user to wait even though there is no next set or exercise.
      if (freshUnitDone && freshLastUnit) {
        triggerFinishAction()
        return
      }

      // Singleton units are ordinary exercises: start rest timer and display completion sheet AFTER rest ends
      if (freshUnitDone) {
        startRest(restSeconds, () => {
          if (!freshLastUnit && !askTop) {
            const nextUnit = freshUnits[freshUnitIdx + 1]
            if (nextUnit?.length) update(s => { if (s.active) s.active.cur = nextUnit[0] })
          }
          triggerFinishAction()
        })
        return
      }
      if (!freshUnit || freshUnit.length <= 1) {
        startRest(restSeconds)
        return
      }

      const step = supersetFlowStep(fresh.entries, freshUnit, idx)
      if (!step) return
      if (step.unitDone) {
        startRest(restSeconds, () => {
          if (!freshLastUnit) {
            const nextUnit = freshUnits[freshUnitIdx + 1]
            // The top-weight sheet's explicit "Just close" path owns the choice not to advance.
            if (!askTop && nextUnit?.length) update(s => { if (s.active) s.active.cur = nextUnit[0] })
          }
          triggerFinishAction()
        })
      } else {
        if (step.nextIdx != null) update(s => { if (s.active) s.active.cur = step.nextIdx })
        if (step.roundDone) startRest(restSeconds)
      }
    } else if (!checked) {
      stopRest(false)
    }
  }

  return <div className="narrow active-workout workout-player-page">
    <div className="workout-session-bar">
      <div className="hdr workout-session-header">
        <div className="workout-session-title"><strong>{A.name}</strong><span>{t('{0} sets', done + '/' + total)}</span></div>
        <div className="wp-session-clock"><Elapsed active={A} /></div>
        <button className="iconbtn" aria-label={t('Discard')} onClick={() => confirmSheet({ title: t('Discard workout?'), message: t('The sets you logged in this session will be lost.'), confirmText: t('Discard'), danger: true, onConfirm: () => { abandonWorkout(); nav('/home') } })}><Icon name="xmark" /></button>
      </div>
      {A.entries.length > 0 && <details className="wp-queue-details"><summary>{t('Exercises')}<span>{cur + 1}/{A.entries.length}</span><Icon name="chevronDown" /></summary><div className="workout-exercise-rail" aria-label={t('Exercises')}>
        {units.map((indices, index) => {
          const entries = indices.map(entryIndex => A.entries[entryIndex])
          const unitDone = entries.every(entry => entry.sets.length > 0 && entry.sets.every(set => set.done))
          const unitSets = entries.reduce((count, entry) => count + entry.sets.length, 0)
          const unitSetsDone = entries.reduce((count, entry) => count + entry.sets.filter(set => set.done).length, 0)
          const label = entries.map(entry => exerciseName(exOr(entry.id))).join(' + ')
          const targetIndex = indices.find(entryIndex => A.entries[entryIndex].sets.some(set => !set.done)) ?? indices[0]
          return <button type="button" key={indices.join('-')} className={'workout-exercise-tab' + (index === unitIdx ? ' is-active' : '') + (unitDone ? ' is-done' : '')}
            disabled={navigationLocked} aria-current={index === unitIdx ? 'step' : undefined}
            onClick={() => navigateExercise(targetIndex)}>
            <span>{unitDone ? <Icon name="check" /> : index + 1}</span>
            <b>{label}</b>
            <small>{unitSetsDone}/{unitSets}</small>
          </button>
        })}
        <button type="button" className="workout-exercise-add" disabled={adjustmentsLocked} aria-label={t('Add exercise')} onClick={addExerciseFlow}><Icon name="plus" /></button>
      </div></details>}
    </div>

    {A.entries.length ? <>
      {isSuperset && <div className="wp-superset-context">
        <div className="ss-hd"><Icon name="link" /><span>{t('Superset · do these back-to-back, rest when done')}</span></div>
        <div className="wp-superset-members">{unit.map(idx => <button type="button" key={idx} disabled={navigationLocked} aria-current={cur === idx ? 'step' : undefined} onClick={() => navigateExercise(idx)}>{exerciseName(exOr(A.entries[idx].id))}</button>)}</div>
      </div>}
      <div ref={el => { exRefs.current[cur] = el }} className={'workout-unit-stage' + (isSuperset ? ' ss-ex' : '')} data-exidx={cur}>
        <WorkoutExercisePlayer entryIdx={cur} locked={!workoutStarted} onStartWorkout={startWorkout}
          onToggle={i => toggle(cur, i)} onField={(i, f, v) => setField(cur, i, f, v)} onStartTimed={i => startTimed(cur, i)}
          onPrevious={() => navigateExercise(cur - 1)} onNext={() => navigateExercise(cur + 1)} previousDisabled={navigationLocked || cur === 0} nextDisabled={navigationLocked || cur === A.entries.length - 1}
          exerciseDots={<div className="wp-exercise-dots" aria-label={t('Exercises')}>{A.entries.map((entry, idx) => <button type="button" key={idx} className={'wp-exercise-dot' + (entry.sets.length && entry.sets.every(set => set.done) ? ' is-done' : '')}
            aria-label={`${idx + 1}. ${exerciseName(exOr(entry.id))}`} aria-current={idx === cur ? 'step' : undefined} disabled={navigationLocked} onClick={() => navigateExercise(idx)} />)}</div>} />
      </div>
    </> : <div className="empty"><div className="ico"><Icon name="shuffle" /></div>{t('Freestyle workout — add your first exercise.')}</div>}

    {!A.entries.length && <Button variant="primary" onClick={addExerciseFlow} icon="plus">{t('Add exercise')}</Button>}
    {A.entries.length > 0 && <details className="workout-tools" key={`${A.id}:${unit.join('-')}`}>
      <summary className="workout-tools-toggle"><Icon name="wrench" /><span>{t('Workout adjustments')}</span><Icon name="chevronDown" /></summary>
      <div className="workout-tools-content">
        {unit.map((idx, num) => <div key={idx}>
          {num > 0 && <div className="workout-tool-divider" />}
          <ExerciseAdjustments entryIdx={idx} locked={adjustmentsLocked}
            onAddSet={() => addSet(idx)} onRemoveSet={() => removeSet(idx)} onAddWarmup={() => addWarmup(idx)} onRemoveSetAt={i => removeSetAt(idx, i)}
            onUseLast={() => useLastValues(idx)} onReplace={() => replaceExercise(idx)} onPairPrev={onPairPrev} onPairNext={onPairNext} />
        </div>)}
        <div className="workout-tool-divider" />
        <div className="workout-tool-actions">
          {A.assignmentId && !done && !A.progressionApplied && <Button size="sm" variant="ghost" disabled={adjustmentsLocked} onClick={applySuggestedProgression}>{t('Aplicar progressão sugerida')}</Button>}
          {isSuperset && <Button size="sm" variant="ghost" icon="link" disabled={adjustmentsLocked} onClick={() => unpairAt(cur)}>{t('Unpair')}</Button>}
          <Button size="sm" variant="ghost" icon="minus" className="workout-danger-action" disabled={adjustmentsLocked} onClick={removeExerciseSheet}>{t('Remove exercise')}</Button>
        </div>
      </div>
    </details>}
    <section className="workout-session-footer" aria-label={t('Workout summary')}>
      <details className="wp-session-details"><summary>{t('Workout summary')}<Icon name="chevronDown" /></summary><div className="workout-progress-summary">
        <h2>{t('Workout summary')}</h2>
        <p><span>{t('{0} sets', done + '/' + total)}</span><span>{t('{0} exercises', completedExercises + '/' + A.entries.length)}</span></p>
      </div></details>
      <div className="workout-primary-action">
        <Button variant={allExercisesDone ? 'primary' : 'ghost'} icon={allExercisesDone ? 'flag' : 'check'} onClick={finishWorkout}>
          {allExercisesDone ? t('Finish workout') : t('Finish workout early')}
        </Button>
      </div>
    </section>
  </div>
}

export default function Workout() {
  const active = useStore(s => s.S.active)
  return active ? <ActiveWorkout /> : <StartChooser />
}
