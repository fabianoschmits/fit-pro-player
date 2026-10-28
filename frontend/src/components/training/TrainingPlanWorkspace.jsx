import { DAYN, DAYS, exCount } from '../../lib/format.js'
import { routineName } from '../../lib/starter.js'
import { t } from '../../lib/i18n.js'
import RoutineMuscleThumb from '../RoutineMuscleThumb.jsx'
import Icon from '../Icon.jsx'
import { Button } from '../ui.jsx'
import { useState } from 'react'
const WEEK = [1, 2, 3, 4, 5, 6, 0]
export function PlanWeek({ state, onDay, updates = {} }) {
  return <section><h4 className="sec">{t('Week schedule')}</h4><div className="plan-week-card"><div className="plan-week-grid">
    {WEEK.map(day => { const routine = state.routines.find(r => r.id === state.week[day]); return <button key={day} className={'plan-day' + (routine ? ' on' : '') + (routine?.assigned ? ' professional' : '')} disabled={!onDay} aria-label={`${t(DAYN[day])}: ${routine ? routineName(routine) : t('Rest')}`} onClick={() => onDay?.(day)}>
      <span className="plan-day-label">{t(DAYS[day])}</span>{routine?.assigned && <span className="plan-day-professional"><Icon name="shield" /><span>Prof.</span></span>}{updates[day] && <span className="tag acc workout-update-badge">Atualizado</span>}<span className="plan-day-icon">{routine ? <RoutineMuscleThumb routine={routine} body={state.body} /> : <Icon name="moon" />}</span><span className="plan-day-name">{routine ? routineName(routine) : t('Rest')}</span>
    </button> })}
  </div></div></section>
}
export function RoutineList({ state, onOpen, onAdd, routines = state.routines, title = t('Routines'), className = '', pageSize = 5 }) {
  const [visible, setVisible] = useState(pageSize)
  const shown = routines.slice(0, visible)
  return <section className={className}><div className="row between plan-section-head"><h4 className="sec">{title}</h4>{onAdd && <Button size="sm" variant="tinted" icon="plus" onClick={onAdd}>{t('New')}</Button>}</div>
    <div className="list plan-routine-list">{shown.map(routine => <button key={routine.id} className="item" onClick={() => onOpen(routine.id)}><span className="lrow-i"><RoutineMuscleThumb routine={routine} body={state.body} /></span><span className="grow"><span className="tt">{routineName(routine)}</span><span className="ss">{exCount(routine.ex.length)}</span></span><Icon name="chevronRight" /></button>)}</div>
    {routines.length > shown.length && <Button className="plan-show-more" variant="ghost" onClick={() => setVisible(count => count + pageSize)}>Mostrar mais</Button>}
  </section>
}
export default function TrainingPlanWorkspace({ state, onDay, onOpen, onAdd, routines, routineTitle, children }) {
 return <div className="training-plan-workspace"><div className="cols plan-cols"><PlanWeek state={state} onDay={onDay} /><RoutineList state={state} onOpen={onOpen} onAdd={onAdd} routines={routines} title={routineTitle} className="created-workouts" /></div>{children}</div>
}
