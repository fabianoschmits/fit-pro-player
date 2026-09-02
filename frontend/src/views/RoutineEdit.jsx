import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr, exerciseName } from '../lib/exercises.js'
import { DAYN, DAYS, uid, sentenceCase } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { planSetupProgress, smartDefaultConfig } from '../lib/ux.js'
import { supersetUnits, cleanupSg, exLine } from '../lib/history.js'
import { Thumb } from '../components/Media.jsx'
import { glyphPicker, exercisePicker, exConfigSheet, confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { Button, SelectRow } from '../components/ui.jsx'
import { POLICIES_FOR, POLICY_NAME, POLICY_DESC } from '../lib/progression.js'
import BodyMap from '../components/BodyMap.jsx'
import PlanProgress from '../components/PlanProgress.jsx'
import { loadOfRoutine, rankOf, MUSCLE_NAME } from '../lib/muscles.js'

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0]

export default function RoutineEdit() {
  const nav = useNavigate()
  const { id } = useParams()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [organizing, setOrganizing] = useState(false)
  const r = S.routines.find(x => x.id === id)
  useEffect(() => { if (!r) nav('/plan') }, [!!r])
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

  const units = supersetUnits(r.ex)
  const unitFirst = new Set(units.filter(u => u.length > 1).map(u => u[0]))
  const inSS = new Set(units.filter(u => u.length > 1).flat())
  const assignedDays = WEEK_DAYS.filter(day => S.week[day] === id)
  const planProgress = planSetupProgress(S)

  return <div className="narrow routine-builder">
    {planProgress && <PlanProgress progress={planProgress} />}
    <div className="hdr routine-builder-head">
      <button className="iconbtn" onClick={() => nav('/plan')} aria-label={t('Plan')}><Icon name="chevronLeft" /></button>
      <div className="routine-name-wrap">
        <input className="input routine-name" value={r.name}
          onChange={e => update(s => { s.routines.find(x => x.id === id).name = e.target.value })}
          onBlur={e => update(s => { s.routines.find(x => x.id === id).name = e.target.value.trim() || t('Routine') })}
          aria-label={t('Routine')} />
      </div>
      <button className="iconbtn" aria-label={t('Pick an icon')} onClick={() => glyphPicker(r.emoji, g => update(s => { s.routines.find(x => x.id === id).emoji = g }))}><Icon name={glyphOf(r.emoji)} /></button>
    </div>

    <div className="row between routine-section-head">
      <h4 className="sec">{t('Exercises')}</h4>
      {r.ex.length > 1 && <Button size="sm" variant="tinted" onClick={() => setOrganizing(v => !v)}>{organizing ? t('Done') : t('Edit')}</Button>}
    </div>

    {r.ex.length ? <div className="list">{r.ex.map((entry, i) => {
      const ex = exOr(entry.id)
      const linkedPrev = i > 0 && entry.sg && r.ex[i - 1].sg === entry.sg
      return <div key={i}>
        {unitFirst.has(i) && <div className="ss-label"><Icon name="link" />{t('Superset')}</div>}
        <div className={'item' + (inSS.has(i) ? ' in-ss' : '')}>
          <button className="routine-item-main" onClick={() => {
            exConfigSheet(ex, entry, cfg => edit(x => { x[i] = { id: x[i].id, sg: x[i].sg, ...cfg } }), () => edit(x => { x.splice(i, 1); cleanupSg(x) }), r)
          }}>
            <Thumb ex={ex} />
            <span className="grow"><span className="tt capitalize">{exerciseName(ex)}</span><span className="ss">{exLine(entry, S.unit)}</span></span>
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
    <Button variant="primary" onClick={addExercise} icon="plus">{t('Add exercise')}</Button>

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
            aria-label={`${t(DAYN[day])}: ${selected ? r.name : other ? other.name : t('Rest')}`}
            aria-pressed={selected} onClick={() => toggleDay(day)}>
            <span className="plan-day-label">{t(DAYS[day])}</span>
            <span className="plan-day-icon"><Icon name={selected ? glyphOf(r.emoji) : other ? glyphOf(other.emoji) : 'moon'} /></span>
            <span className="plan-day-name">{selected ? r.name : other ? other.name : t('Rest')}</span>
          </button>
        })}
      </div>
    </div>

    <Button variant="primary" icon="check" onClick={() => nav('/plan')}>{t('Done')}</Button>

    {r.ex.length > 0 && (() => {
      const load = loadOfRoutine(r)
      const { worked } = rankOf(load)
      return <div className="card routine-muscles">
        <h2>{t('What this session hits')}</h2>
        <BodyMap load={load} body={S.body} />
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
        <div style={{ height: 10 }} />
        <Button variant="danger" onClick={() => confirmSheet({
          title: t('Delete routine?'), message: t('“{0}” and its exercises will be removed.', r.name), confirmText: t('Delete'), danger: true,
          onConfirm: () => {
            update(s => {
              s.routines = s.routines.filter(x => x.id !== id)
              Object.keys(s.week).forEach(k => { if (s.week[k] === id) delete s.week[k] })
              Object.keys(s.dayPlan).forEach(k => { if (s.dayPlan[k] === id) delete s.dayPlan[k] })
            })
            nav('/plan')
          }
        })}>{t('Delete routine')}</Button>
      </div>
    </details>
  </div>
}
