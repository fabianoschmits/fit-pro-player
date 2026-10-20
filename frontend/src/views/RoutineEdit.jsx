import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr, exerciseName } from '../lib/exercises.js'
import { DAYN, DAYS, uid, routineId, sentenceCase } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { planSetupProgress, smartDefaultConfig } from '../lib/ux.js'
import { supersetUnits, cleanupSg, exLine } from '../lib/history.js'
import { Thumb } from '../components/Media.jsx'
import { exercisePicker, exConfigSheet, confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import RoutineMuscleThumb from '../components/RoutineMuscleThumb.jsx'
import { Button, SelectRow } from '../components/ui.jsx'
import { POLICIES_FOR, POLICY_NAME, POLICY_DESC } from '../lib/progression.js'
import BodyMap from '../components/BodyMap.jsx'
import PlanProgress from '../components/PlanProgress.jsx'
import { loadOfRoutine, rankOf, MUSCLE_NAME } from '../lib/muscles.js'
import { routineName, starterRoutines } from '../lib/starter.js'
import { DEFAULT_GLYPH } from '../lib/glyphs.js'
import { FppActionFeedback } from '../components/FppFeedback.jsx'

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0]
const MUSCLE_ANCHORS = {
  trapezius: { front: { x: 50, y: 18 }, back: { x: 50, y: 19 } },
  deltoids: { front: { x: 32, y: 24 }, back: { x: 68, y: 24 } },
  chest: { front: { x: 50, y: 30 } },
  'upper-back': { back: { x: 50, y: 31 }, front: { x: 50, y: 31 } },
  serratus: { front: { x: 34, y: 36 }, back: { x: 66, y: 36 } },
  biceps: { front: { x: 27, y: 37 }, back: { x: 73, y: 37 } },
  triceps: { back: { x: 27, y: 38 }, front: { x: 73, y: 38 } },
  forearm: { front: { x: 25, y: 50 }, back: { x: 75, y: 50 } },
  abs: { front: { x: 50, y: 43 } },
  obliques: { front: { x: 42, y: 45 }, back: { x: 58, y: 45 } },
  'lower-back': { back: { x: 50, y: 53 }, front: { x: 50, y: 53 } },
  gluteal: { back: { x: 50, y: 62 } },
  quadriceps: { front: { x: 42, y: 70 }, back: { x: 58, y: 70 } },
  hamstring: { back: { x: 42, y: 70 }, front: { x: 58, y: 70 } },
  adductors: { front: { x: 50, y: 71 }, back: { x: 50, y: 71 } },
  'hip-flexors': { front: { x: 42, y: 62 } },
  calves: { back: { x: 42, y: 86 }, front: { x: 58, y: 86 } },
  tibialis: { front: { x: 42, y: 86 }, back: { x: 58, y: 86 } },
}

export function RoutineTemplatePicker({ currentId, close }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const suggested = starterRoutines(S)
  const existing = S.routines.filter(routine => routine.id !== currentId && !routine.starterKey && !routine.planGenerated)

  const choose = source => {
    update(state => {
      const target = state.routines.find(routine => routine.id === currentId)
      if (!target) return
      target.name = routineName(source)
      target.emoji = source.emoji || DEFAULT_GLYPH
      target.ex = (source.ex || []).map(entry => ({ ...entry }))
      delete target.starterKey
      delete target.planGenerated
      delete target.personalizedKey
      target.starterCustomName = true
    })
    close()
    useUI.getState().toast(t('Template loaded. Adjust the workout before finishing.'))
  }

  const option = (source, label) => <Button key={source.id} appearance="custom" className="routine-template-option" onClick={() => choose(source)}>
    <span className="routine-template-icon" aria-hidden="true"><RoutineMuscleThumb routine={source} body={S.body} /></span>
    <span className="routine-template-copy"><strong>{routineName(source)}</strong><small>{label}</small></span>
    <Icon name="chevronRight" className="chev" />
  </Button>

  return <div className="routine-template-picker">
    <h3>{t('Choose a workout to get started')}</h3>
    <p className="dim">{t('Load a copy, edit it as you like, and finish when ready.')}</p>
    <h4>{t('Suggested by Fit Pro Player')}</h4>
    <div className="routine-template-list">{suggested.map(routine => option(routine, t('Recommended template')))}</div>
    <h4>{t('My workouts')}</h4>
    {existing.length
      ? <div className="routine-template-list">{existing.map(routine => option(routine, t('{0} exercises', routine.ex?.length || 0)))}</div>
      : <p className="small dim routine-template-empty">{t('You do not have another workout to reuse yet.')}</p>}
    <Button variant="plain" className="routine-template-cancel" onClick={close}>{t('Cancel')}</Button>
  </div>
}

export default function RoutineEdit() {
  const nav = useNavigate()
  const { id } = useParams()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [organizing, setOrganizing] = useState(false)
  const [selectedMuscle, setSelectedMuscle] = useState(null)
  const [saveError, setSaveError] = useState('')
  const muscleMapRef = useRef(null)
  const r = S.routines.find(x => x.id === id)
  useEffect(() => { if (!r) nav('/plan') }, [!!r])
  useEffect(() => {
    if (!selectedMuscle) return undefined
    const clear = event => {
      if (!muscleMapRef.current?.contains(event.target)) setSelectedMuscle(null)
    }
    document.addEventListener('pointerdown', clear)
    return () => document.removeEventListener('pointerdown', clear)
  }, [selectedMuscle])
  if (!r) return null

  const edit = fn => update(s => { fn(s.routines.find(x => x.id === id).ex) })
  const move = (i, dir) => edit(ex => { const j = i + dir; if (j < 0 || j >= ex.length) return;[ex[i], ex[j]] = [ex[j], ex[i]]; cleanupSg(ex) })
  const toggleLink = i => edit(ex => {
    if (i < 1) return
    const cur = ex[i], prev = ex[i - 1]
    if (cur.sg && prev.sg && cur.sg === prev.sg) delete cur.sg
    else { const gid = prev.sg || ('sg' + uid()); prev.sg = gid; cur.sg = gid }
    cleanupSg(ex)
  })
  const toggleDay = day => update(s => {
    if (s.week[day] === id) delete s.week[day]
    else s.week[day] = id
  })
  const addExercise = () => exercisePicker((ex, meta) => {
    if (meta?.configure) {
      exConfigSheet(ex, null, cfg => edit(list => { list.push({ id: ex.id, ...cfg }) }), null, r)
      return
    }
    const cfg = smartDefaultConfig(ex.id, S)
    edit(list => { list.push({ id: ex.id, ...cfg }) })
    useUI.getState().toast(t('"{0}" added — tap to adjust', exerciseName(ex)))
  }, { routineId: id, quickAdd: true })
  const duplicateRoutine = () => {
    const copy = {
      ...r,
      id: routineId(),
      name: `${displayName} 2`,
      ex: r.ex.map(entry => ({ ...entry })),
    }
    delete copy.starterKey
    delete copy.starterCustomName
    update(state => { state.routines.push(copy) })
    useUI.getState().toast(t('Routine duplicated'))
    nav('/plan/r/' + copy.id)
  }
  const saveRoutine = async () => {
    setSaveError('')
    if (!(await useStore.getState().flushPersistence())) throw new Error('local-write-failed')
    const store = useStore.getState()
    if (store.getActiveLocalScope?.()?.kind === 'account' && store.S._pendingSync?.plan) {
      await store.retryAccountSync()
      if (useStore.getState().S._pendingSync?.plan) { nav('/plan'); return false }
    }
  }
  const deleteRoutine = () => confirmSheet({
    title: t('Delete routine?'), message: t('“{0}” and its exercises will be removed.', displayName), confirmText: t('Delete'), danger: true,
    onConfirm: () => {
      update(s => {
        s.routines = s.routines.filter(x => x.id !== id)
        Object.keys(s.week).forEach(k => { if (s.week[k] === id) delete s.week[k] })
        Object.keys(s.dayPlan).forEach(k => { if (s.dayPlan[k] === id) delete s.dayPlan[k] })
      })
      return true
    },
  })
  const openTemplatePicker = () => useUI.getState().openSheet(close => <RoutineTemplatePicker currentId={id} close={close} />)

  const units = supersetUnits(r.ex)
  const unitFirst = new Set(units.filter(u => u.length > 1).map(u => u[0]))
  const inSS = new Set(units.filter(u => u.length > 1).flat())
  const assignedDays = WEEK_DAYS.filter(day => S.week[day] === id)
  const planProgress = planSetupProgress(S)
  const displayName = routineName(r)
  const canDelete = !r.assigned

  return <div className="narrow routine-builder">
    {planProgress && <PlanProgress progress={planProgress} />}
    <div className="hdr routine-builder-head">
      <button className="iconbtn" onClick={() => nav('/plan')} aria-label={t('Plan')}><Icon name="chevronLeft" /></button>
      <div className="routine-name-wrap">
        <input className="input routine-name" value={displayName}
          onChange={e => update(s => { const routine = s.routines.find(x => x.id === id); routine.name = e.target.value; delete routine.starterKey; routine.starterCustomName = true })}
          onBlur={e => update(s => { s.routines.find(x => x.id === id).name = e.target.value.trim() || t('Routine') })}
          aria-label={t('Routine')} />
      </div>
      <span className="routine-builder-head-thumb" aria-hidden="true"><RoutineMuscleThumb routine={r} body={S.body} /></span>
    </div>

    <div className="row between routine-section-head">
      <h4 className="sec">{t('Exercises')}</h4>
      {r.ex.length > 1 && <Button size="sm" variant="tinted" onClick={() => setOrganizing(v => !v)}>{organizing ? t('Done') : t('Edit')}</Button>}
    </div>

    {r.ex.length ? <div className="list routine-exercise-list">{r.ex.map((entry, i) => {
      const ex = exOr(entry.id)
      const linkedPrev = i > 0 && entry.sg && r.ex[i - 1].sg === entry.sg
      return <div key={i}>
        {unitFirst.has(i) && <div className="ss-label"><Icon name="link" />{t('Superset')}</div>}
        <div className={'item' + (inSS.has(i) ? ' in-ss' : '')}>
          <button className="routine-item-main" onClick={() => {
            exConfigSheet(ex, entry, cfg => edit(x => { x[i] = { id: x[i].id, sg: x[i].sg, ...cfg } }), () => edit(x => { x.splice(i, 1); cleanupSg(x) }), r)
          }}>
            <Thumb ex={ex} />
            <span className="grow"><span className="tt capitalize">{exerciseName(ex)}</span><span className="ss">{exLine(entry, S.displayUnit || 'kg')}</span></span>
            {!organizing && <Icon name="chevronRight" className="chev" />}
          </button>
          {organizing && <span className="routine-item-tools">
            {i > 0 && <button className={'iconbtn' + (linkedPrev ? ' on-ss' : '')} title={t('Superset with exercise above')} aria-label={t('Superset with exercise above')} onClick={ev => { ev.stopPropagation(); toggleLink(i) }}><Icon name="link" /></button>}
            <button className="iconbtn" aria-label={t('Move up')} disabled={i === 0} onClick={ev => { ev.stopPropagation(); move(i, -1) }}><Icon name="chevronUp" /></button>
            <button className="iconbtn" aria-label={t('Move down')} disabled={i === r.ex.length - 1} onClick={ev => { ev.stopPropagation(); move(i, 1) }}><Icon name="chevronDown" /></button>
          </span>}
        </div>
      </div>
    })}</div> : <div className="empty routine-empty"><div className="ico"><Icon name="dumbbell" /></div>{t('No exercises yet — add your first one.')}</div>}

    {organizing && <div className="small dim row routine-organize-help"><Icon name="link" />{t('Tap the link button on an exercise to superset it with the one above — you’ll do them back-to-back.')}</div>}
    <div className="routine-builder-actions">
      <Button variant="tinted" onClick={addExercise} icon="plus">{t('Add exercise')}</Button>
      <Button variant="plain" onClick={duplicateRoutine} icon="reset">{t('Duplicate routine')}</Button>
    </div>
    {!r.ex.length && <Button appearance="custom" className="routine-template-link" onClick={openTemplatePicker} icon="sparkles">{t('Start with a suggested or existing workout')}</Button>}

    <div className="card routine-week-card">
      <div className="row between routine-card-title">
        <h2>{t('Week schedule')}</h2>
        <span className={'tag' + (assignedDays.length ? ' acc' : '')}>{assignedDays.length} / 7</span>
      </div>
      <div className="plan-week-grid compact">
        {WEEK_DAYS.map(day => {
          const selected = S.week[day] === id
          const other = !selected && S.routines.find(x => x.id === S.week[day])
          return <button key={day} className={'plan-day' + (selected ? ' on' : '') + (other ? ' has-other' : '')}
            aria-label={`${t(DAYN[day])}: ${selected ? displayName : other ? routineName(other) : t('Rest')}`}
            aria-pressed={selected} onClick={() => toggleDay(day)}>
            <span className="plan-day-label">{t(DAYS[day])}</span>
            <span className="plan-day-icon">{selected ? <RoutineMuscleThumb routine={r} body={S.body} /> : other ? <RoutineMuscleThumb routine={other} body={S.body} /> : <Icon name="moon" />}</span>
            <span className="plan-day-name">{selected ? displayName : other ? routineName(other) : t('Rest')}</span>
          </button>
        })}
      </div>
    </div>

    {saveError && <FppActionFeedback state="error">{saveError}</FppActionFeedback>}
    <div className="routine-completion-actions">
      <Button variant="primary" icon="check" onAction={saveRoutine} onSuccess={() => nav('/plan')} loadingLabel={t('Salvando…')} successLabel={t('Salvo')}
        onError={() => setSaveError(t('Não foi possível salvar neste dispositivo. Tente novamente.'))}>{t('Done')}</Button>
      {canDelete && <Button variant="danger" icon="trash" onClick={deleteRoutine}>{t('Delete routine')}</Button>}
    </div>

    {r.ex.length > 0 && (() => {
      const load = loadOfRoutine(r)
      const { worked } = rankOf(load)
      const anchor = MUSCLE_ANCHORS[selectedMuscle?.slug]?.[selectedMuscle?.view] || MUSCLE_ANCHORS[selectedMuscle?.slug]?.front
      return <div className="card routine-muscles" ref={muscleMapRef} onClick={event => { if (event.target === event.currentTarget) setSelectedMuscle(null) }}>
        <h2>{t('What this session hits')}</h2>
        {selectedMuscle && anchor && <div className="routine-muscle-popover" style={{ '--muscle-x': `${anchor.x}%`, '--muscle-y': `${anchor.y}%` }} role="status">{t(MUSCLE_NAME[selectedMuscle.slug])}</div>}
        <BodyMap load={load} body={S.body} selected={selectedMuscle?.slug} onMuscle={(slug, view) => setSelectedMuscle({ slug, view })} />
        <div className="mchips">
          {worked.slice(0, 6).map(m => <span key={m} className="mchip">{sentenceCase(t(MUSCLE_NAME[m]))}</span>)}
        </div>
      </div>
    })()}

    <details className="routine-advanced" style={S.simpleMode !== false ? { display: 'none' } : undefined}>
      <summary><span><Icon name="gear" />{t('More')}</span><Icon name="chevronDown" /></summary>
      <div className="routine-advanced-body">
        <div className="sect-b">
          <SelectRow icon="chartLine" title={t('Progression')} sheetTitle={t('Progression')}
            value={r.prog || 'linear'} onChange={v => update(s => { s.routines.find(x => x.id === id).prog = v })}
            options={POLICIES_FOR.reps.map(p => ({ value: p, label: t(POLICY_NAME[p]), subtitle: t(POLICY_DESC[p]) }))} />
        </div>
        <div className="small dim routine-advanced-copy">{t('Applies to every exercise in this routine that does not set its own rule.')}</div>
      </div>
    </details>
  </div>
}
