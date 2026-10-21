import { Fragment, useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr, exerciseName } from '../lib/exercises.js'
import { lastEntryFor, bestWeightFor, setLabel, modeOf, isBw, isPerSide, sideReps, repStep, EFFORT, effortOf, stepEffort, capEffort } from '../lib/history.js'
import { fmtNum, fmtDate, sentenceCase } from '../lib/format.js'
import { isWarmupRow } from '../lib/workout-model.js'
import { fromDisplayMass, toDisplayMass } from '../lib/mass.js'
import { t } from '../lib/i18n.js'
import { exerciseDetailSheet } from '../sheets.jsx'
import Media from './Media.jsx'
import WorkSetOverlay from './WorkSetOverlay.jsx'
import Icon from './Icon.jsx'
import { Button, Check, NumberField } from './ui.jsx'

export default function WorkoutExercisePlayer({ entryIdx, compact, locked = false, onStartWorkout, onToggle, onField, onStartTimed,
  onPrevious, onNext, previousDisabled, nextDisabled, exerciseDots }) {
  const S = useStore(s => s.S)
  const working = useUI(s => s.work)
  const timer = useUI(s => s.timer)
  const manualSet = useUI(s => s.manualSet)
  const [setsOpen, setSetsOpen] = useState(false)
  const previouslyDone = useRef(false)
  const entry = S.active?.entries[entryIdx]
  const allDone = !!entry?.sets.length && entry.sets.every(s => s.done)
  useEffect(() => {
    if (allDone && !previouslyDone.current) setSetsOpen(false)
    previouslyDone.current = allDone
  }, [allDone])
  useEffect(() => { setSetsOpen(false) }, [entryIdx, entry?.id])
  if (!entry) return null

  const ex = exOr(entry.id)
  const displayUnit = S.displayUnit || 'kg'
  const cfg = { ...(entry.target || {}), id: entry.id }
  const mode = modeOf(cfg)
  const cardio = mode === 'cardio'
  const timed = mode === 'time'
  const nextPending = entry.sets.findIndex(s => !s.done)
  const completedCount = entry.sets.filter(s => s.done).length
  const sessionId = `${S.active.id}:${S.active.start}`
  const runningIndex = entry.sets.findIndex((s, i) => !s.done && (
    (working?.phase === 'work' && working.entryIdx === entryIdx && working.setIdx === i)
    || (manualSet?.sessionId === sessionId && manualSet.entryIdx === entryIdx && manualSet.setIdx === i && manualSet.exerciseId === entry.id)
  ))
  const currentIndex = runningIndex >= 0 ? runningIndex : nextPending
  const current = entry.sets[currentIndex]
  const resting = !!timer || working?.phase === 'rest'
  const anyRunning = !!manualSet || working?.phase === 'work'
  const executing = !locked && !resting && runningIndex >= 0
  const ready = !locked && !resting && !anyRunning && currentIndex >= 0
  const phaseNumber = i => entry.sets.slice(0, i + 1).filter(s => isWarmupRow(s) === isWarmupRow(entry.sets[i])).length
  const currentNumber = currentIndex >= 0 ? phaseNumber(currentIndex) : 0
  const hintId = `set-execution-${entryIdx}-${currentIndex}`

  const bw = !cardio && isBw(cfg)
  const added = bw && entry.sets.some(s => s.w > 0)
  const loadCol = { f: 'w', step: fromDisplayMass(displayUnit === 'lb' ? 2.5 : 1, displayUnit), dec: true, hd: bw ? t('Added ({0})', displayUnit) : t('Weight ({0})', displayUnit) }
  const repCol = { f: 'r', step: repStep(cfg), dec: false, hd: t('Reps') }
  const col1 = cardio ? { f: 'min', step: 1, dec: false, hd: t('Duration (min)') }
    : timed ? { f: 'sec', step: 5, dec: false, hd: t('Seconds') } : bw && !added ? repCol : loadCol
  const col2 = cardio ? { f: 'speed', step: 0.5, dec: true, hd: t('Speed (km/h)') }
    : timed ? (bw && !added ? null : loadCol) : bw && !added ? null : repCol
  const kind = ['rir', 'rpe'].includes(cfg.effort) ? cfg.effort : effortOf(S)
  const col3 = mode === 'reps' && EFFORT[kind] ? { ...EFFORT[kind], eff: kind, dec: true, opt: true, hd: t(EFFORT[kind].hd) } : null
  const columns = [{ col: col1, cls: 'w' }, ...(col2 ? [{ col: col2, cls: 'r' }] : []), ...(col3 ? [{ col: col3, cls: 'eff' }] : [])]
  const bump = (s, i, col, direction) => {
    const value = col.eff ? stepEffort(col.eff, s[col.f], direction)
      : Math.max(0, Math.round(((s[col.f] || 0) + direction * col.step) * 100) / 100)
    onField(i, col.f, value)
  }
  const cell = (s, i, col, cls) => <div className={'stp ' + cls}>
    <button type="button" aria-label={`${t('Decrease')} ${col.hd}`} disabled={locked} onClick={() => bump(s, i, col, -1)}><Icon name="minus" /></button>
    <span className="val"><NumberField decimal={col.dec} nullable={col.opt}
      value={col.f === 'w' ? (toDisplayMass(s[col.f] ?? 0, displayUnit) ?? '') : (s[col.f] ?? '')}
      aria-label={col.hd} disabled={locked}
      onChange={v => onField(i, col.f, col.eff ? capEffort(col.eff, v) : col.f === 'w' ? fromDisplayMass(v, displayUnit) : v)} /></span>
    <button type="button" aria-label={`${t('Increase')} ${col.hd}`} disabled={locked} onClick={() => bump(s, i, col, 1)}><Icon name="plus" /></button>
  </div>

  const startSet = () => {
    if (!ready) return
    if (timed) onStartTimed(currentIndex)
    else useUI.getState().startManualSet(sessionId, entryIdx, currentIndex)
  }
  const completeSet = () => {
    if (!executing) return
    if (working?.phase === 'work' && working.entryIdx === entryIdx && working.setIdx === currentIndex) useUI.getState().finishWorkEarly()
    else onToggle(currentIndex)
  }
  const last = lastEntryFor(S, entry.id)
  const lastLabels = last ? last.sets.filter(s => !isWarmupRow(s)).map(s => setLabel(entry.id, s, last.target, displayUnit)) : []
  const best = cardio ? 0 : Math.max(bestWeightFor(S, entry.id), (S.exWeights[entry.id] || {}).w || 0)
  const plan = entry.plan

  return <section className={'wp-exercise-player' + (locked ? ' is-locked' : '') + (allDone ? ' is-complete' : '')} data-exidx={entryIdx}>
    <div className="wp-series-status"><span>{t('Sets')}</span><strong>{completedCount}/{entry.sets.length}</strong></div>
    <div className="wp-series-track" role="progressbar" aria-label={t('Sets')} aria-valuemin={0} aria-valuemax={entry.sets.length} aria-valuenow={completedCount}>
      {entry.sets.map((s, i) => <span key={i} className={'wp-series-segment' + (s.done ? ' is-done' : i === currentIndex ? ' is-current' : '') + (isWarmupRow(s) ? ' is-warmup' : '')} />)}
    </div>
    <div className="wp-media-card">
      <div className="wp-exercise-header">
        <h2 className="wp-exercise-title workout-exercise-name">{exerciseName(ex)}</h2>
        <div className="wp-exercise-target">{current ? setLabel(entry.id, current, entry.target, displayUnit) : t('Exercise complete')}{cardio && <span>{t('Cardio')}</span>}</div>
        {entry.replacedFrom && <div className="workout-exercise-replacement"><Icon name="shuffle" /><span>{t('Replaces {0}', exerciseName(exOr(entry.replacedFrom)))}</span></div>}
      </div>
      <div className="wp-media"><Media ex={ex} key={entry.id} compact={compact} /></div>
      {/* Weight badge: shown on the card while a set is active (executing or ready) and the exercise uses weight */}
      {current && !cardio && !timed && (executing || ready) && !bw || (current && !cardio && !timed && (executing || ready) && bw && added) ? (
        <div className={'wp-weight-badge' + (executing ? ' is-executing' : '')} aria-hidden="true">
          <span className="wp-weight-badge-value">{toDisplayMass(current.w ?? 0, displayUnit) ?? 0}</span>
          <span className="wp-weight-badge-unit">{displayUnit}</span>
        </div>
      ) : null}
      <button type="button" className="wp-exercise-nav wp-exercise-nav--previous" aria-label={t('Previous exercise')} disabled={previousDisabled || !onPrevious} onClick={onPrevious}><Icon name="chevronLeft" /></button>
      <button type="button" className="wp-exercise-nav wp-exercise-nav--next" aria-label={t('Next exercise')} disabled={nextDisabled || !onNext} onClick={onNext}><Icon name="chevronRight" /></button>
      <button type="button" className="wp-expand" aria-label={t('Details')} onClick={() => exerciseDetailSheet(ex)}><Icon name="expand" /></button>
    </div>
    {exerciseDots}
    {current && <div className="wp-current-set">
      <div className="exercise-input-status"><span>{isWarmupRow(current) ? t('Warm-up') : t('Sets')} {currentNumber}/{entry.sets.filter(s => isWarmupRow(s) === isWarmupRow(current)).length}</span>
        {!cardio && !timed && isPerSide(cfg) && <span className="wp-per-side">{t('{0} per side', fmtNum(sideReps(current.r)))}</span>}
      </div>
      <div className="wp-current-controls" data-metrics={columns.length}>
        {columns.map(({ col, cls }) => <div className="wp-metric" key={col.f}><span className="wp-metric-label">{col.hd}</span>{cell(current, currentIndex, col, cls)}</div>)}
      </div>
    </div>}
    {locked && onStartWorkout ? <Button variant="primary" intent="quick" icon="play" className="wp-main-action exercise-start-card" onClick={onStartWorkout}>{t('Start workout')}</Button>
      : current && <Button variant="primary" intent="quick" icon={resting ? 'moon' : executing ? 'check' : 'play'}
        className={'wp-main-action' + (executing ? ' set-action is-executing' : ready ? ' set-start-action' : resting ? ' is-resting' : '')}
        disabled={!executing && !ready} aria-describedby={hintId}
        aria-label={resting ? t('Resting') : `${executing ? t('Complete set') : t('Start set')} ${currentNumber}`}
        onClick={executing ? completeSet : startSet}>
        {executing && <>
          <span className="wp-execution-signal" aria-hidden="true"><span /></span>
          <span className="wp-execution-mark" aria-hidden="true"><Icon name={cardio ? 'figureRun' : 'figureStrength'} /></span>
        </>}
        {resting ? t('Resting') : executing ? t('Complete set') : `${t('Start set')} ${currentNumber}`}
      </Button>}
    {current && !locked && <div id={hintId} className={'set-execution-hint' + (resting ? ' is-resting' : '')}>
      <strong><Icon name={resting ? 'moon' : executing ? 'flame' : 'play'} />{resting ? t('Resting') : executing ? t('Performing set') : t('Start set')}</strong>
      <span>{resting ? t('When rest ends, tap play to start the next set.') : executing ? t('Tap the highlighted check field when you finish this set.') : t('Tap play to start this set.')}</span>
      {executing && manualSet && <Button variant="ghost" size="sm" intent="quick" className="wp-cancel-set" onClick={() => useUI.getState().stopManualSet()}>{t('Cancel')}</Button>}
    </div>}
    {/* A timed superset may already show its next member while the previous member owns rest. */}
    <WorkSetOverlay entryIdx={working?.phase === 'rest' ? working.entryIdx : entryIdx} />
    {allDone && <Button intent="quick" className="ex-done-banner" icon="check" trailingIcon={setsOpen ? 'minimize' : 'expand'}
      aria-label={setsOpen ? t('Collapse') : t('Expand sets')} aria-expanded={setsOpen} onClick={() => setSetsOpen(value => !value)}>
      {t('Exercise complete')} · {entry.sets.length} {entry.sets.length === 1 ? t('set') : t('sets')}
    </Button>}
    <details className="wp-series-details" open={setsOpen} onToggle={event => setSetsOpen(event.currentTarget.open)}>
      <summary>{t('Sets')} <span>{completedCount}/{entry.sets.length}</span><Icon name="chevronDown" /></summary>
      <div className={'exercise-input-card' + (locked ? ' is-locked' : '')}>
        <div className={'sethead' + (col3 ? ' eff3' : '')}><span className="n-sp" /><span className="w-sp">{col1.hd}</span>{col2 && <span className="r-sp">{col2.hd}</span>}{col3 && <span className="eff-sp">{col3.hd}</span>}<span className="ck-sp" /></div>
        {entry.sets.map((s, i) => {
          const warm = isWarmupRow(s)
          const warmBefore = i > 0 && isWarmupRow(entry.sets[i - 1])
          const number = phaseNumber(i)
          return <div key={i}>
            {warm && !warmBefore && <div className="setph">{t('Warm-up')}</div>}
            {!warm && warmBefore && <div className="setsep" />}
            <div className={'setrow' + (warm ? ' is-warmup' : '') + (s.done ? ' done' : '') + (i === currentIndex ? ' is-current' : '') + (col3 ? ' eff3' : '')} aria-current={i === currentIndex ? 'step' : undefined}>
              <div className="n">{number}</div>
              {columns.map(({ col, cls }) => <Fragment key={col.f}>{cell(s, i, col, cls)}</Fragment>)}
              {s.done ? <Check checked onChange={() => onToggle(i)} playMode disabled={locked || anyRunning} className="set-action"
                ariaLabel={`${warm ? t('Warm-up') : t('Sets')} ${number}: ${t('Done')}`} />
                : <span className="wp-set-status" aria-label={i === runningIndex ? t('Performing set') : t('Start set')}><Icon name={i === runningIndex ? 'flame' : i === currentIndex && resting ? 'moon' : 'play'} /></span>}
            </div>
          </div>
        })}
      </div>
    </details>
    {(ex.tg || ex.bp || ex.eq || cfg.notes || last || best > 0 || (plan?.why && plan.kind !== 'off')) && <details className="wp-exercise-details">
      <summary>{t('Details')}<Icon name="chevronDown" /></summary>
      {(ex.tg || ex.bp) && <span className="tag">{sentenceCase(t(ex.tg || ex.bp))}</span>}
      {ex.eq && <span className="tag">{sentenceCase(t(ex.eq))}</span>}
      {best > 0 && <span className="tag nocap">{t('Best:')} {fmtNum(toDisplayMass(best, displayUnit))} {displayUnit}</span>}
      {cfg.notes && <p className="muted">{cfg.notes}</p>}
      {last && <div className="workout-last-values"><div className="grow"><small>{t('Last time')} · {fmtDate(last.d)}</small><strong>{lastLabels.slice(0, 3).join(' · ')}{lastLabels.length > 3 ? ` · +${lastLabels.length - 3}` : ''}</strong></div></div>}
      {plan?.why && plan.kind !== 'off' && <div className={'progline' + (plan.kind === 'deload' ? ' warn' : '')}><Icon name={plan.kind === 'up' ? 'arrowUp' : plan.kind === 'deload' ? 'arrowDown' : 'lightbulb'} /><span>{t(...plan.why)}</span></div>}
    </details>}
  </section>
}
