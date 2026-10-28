import { DAYN, DAYS, exCount } from '../../lib/format.js'
import { routineName } from '../../lib/starter.js'
import { t } from '../../lib/i18n.js'
import RoutineMuscleThumb from '../RoutineMuscleThumb.jsx'
import Icon from '../Icon.jsx'
import { Button } from '../ui.jsx'
const WEEK = [1, 2, 3, 4, 5, 6, 0]
export function PlanWeek({ state, onDay }) {
  return <section><h4 className="sec">{t('Week schedule')}</h4><div className="plan-week-card"><div className="plan-week-grid">
    {WEEK.map(day => { const routine = state.routines.find(r => r.id === state.week[day]); return <button key={day} className={'plan-day' + (routine ? ' on' : '')} disabled={!onDay} aria-label={`${t(DAYN[day])}: ${routine ? routineName(routine) : t('Rest')}`} onClick={() => onDay?.(day)}>
      <span className="plan-day-label">{t(DAYS[day])}</span><span className="plan-day-icon">{routine ? <RoutineMuscleThumb routine={routine} body={state.body} /> : <Icon name="moon" />}</span><span className="plan-day-name">{routine ? routineName(routine) : t('Rest')}</span>
    </button> })}
  </div></div></section>
}
export function RoutineList({ state, onOpen, onAdd }) {
  return <section><div className="row between plan-section-head"><h4 className="sec">{t('Routines')}</h4>{onAdd && <Button size="sm" variant="tinted" icon="plus" onClick={onAdd}>{t('New')}</Button>}</div>
    <div className="list plan-routine-list">{state.routines.map(routine => <button key={routine.id} className="item" onClick={() => onOpen(routine.id)}><span className="lrow-i"><RoutineMuscleThumb routine={routine} body={state.body} /></span><span className="grow"><span className="tt">{routineName(routine)}</span><span className="ss">{exCount(routine.ex.length)}</span></span><Icon name="chevronRight" /></button>)}</div>
  </section>
}
export default function TrainingPlanWorkspace({ state, onDay, onOpen, onAdd, children }) {
 return <div className="training-plan-workspace"><div className="cols plan-cols"><PlanWeek state={state} onDay={onDay} /><RoutineList state={state} onOpen={onOpen} onAdd={onAdd} /></div>{children}</div>
}
