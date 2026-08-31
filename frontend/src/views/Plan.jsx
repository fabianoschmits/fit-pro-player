import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYN, DAYS, uid, exCount } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { dayAssignSheet, loadStarterPlan, planToolsSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0]

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)

  const addRoutine = () => {
    const suffix = String.fromCharCode(65 + Math.min(S.routines.length, 25))
    const r = { id: uid(), name: `${t('Routine')} ${suffix}`, emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav('/plan/r/' + r.id)
  }

  const scheduledDays = WEEK_DAYS.filter(day => S.week[day] && S.routines.some(r => r.id === S.week[day])).length

  return <>
    <div className="hdr">
      <div><h1>{t('Plan')}</h1><div className="sub">{t('Your weekly routine')}</div></div>
      <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
    </div>

    {!S.routines.length ? <div className="plan-onboarding">
      <div className="card">
        <div className="plan-intro-icon"><Icon name="calendar" /></div>
        <div className="big">{t('Build my own plan')}</div>
        <div className="muted small plan-intro-copy">{t('Set up your weekly routine to get going — or load a ready-made Push / Pull / Legs plan.')}</div>
        <div className="plan-steps" aria-label={t('Plan')}>
          <div><span>1</span>{t('Routines')}</div>
          <i />
          <div><span>2</span>{t('Exercises')}</div>
          <i />
          <div><span>3</span>{t('Week schedule')}</div>
        </div>
        <Button variant="primary" icon="plus" onClick={addRoutine}>{t('Build my own plan')}</Button>
        <div style={{ height: 8 }} />
        <Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>
      </div>
    </div> : <div className="cols plan-cols">
      <section>
        <div className="row between plan-section-head">
          <h4 className="sec">{t('Week schedule')}</h4>
          <span className={'tag' + (scheduledDays ? ' acc' : '')}>{scheduledDays} / 7</span>
        </div>
        <div className="card plan-week-card">
          <div className="plan-week-grid">
            {WEEK_DAYS.map(day => {
              const routine = S.routines.find(r => r.id === S.week[day])
              return <button key={day} className={'plan-day' + (routine ? ' on' : '')}
                aria-label={`${t(DAYN[day])}: ${routine ? routine.name : t('Rest')}`}
                aria-pressed={!!routine} onClick={() => dayAssignSheet(day)}>
                <span className="plan-day-label">{t(DAYS[day])}</span>
                <span className="plan-day-icon"><Icon name={routine ? glyphOf(routine.emoji) : 'moon'} /></span>
                <span className="plan-day-name">{routine ? routine.name : t('Rest')}</span>
              </button>
            })}
          </div>
        </div>
      </section>

      <section>
        <div className="row between plan-section-head">
          <h4 className="sec">{t('Routines')}</h4>
          <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>
        </div>
        <div className="list plan-routine-list">{S.routines.map(r => {
          const days = WEEK_DAYS.filter(day => S.week[day] === r.id)
          return <button key={r.id} className="item" onClick={() => nav('/plan/r/' + r.id)}>
            <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
            <span className="grow">
              <span className="tt">{r.name}</span>
              <span className="ss">{exCount(r.ex.length)}{days.length ? ` · ${days.map(day => t(DAYS[day])).join(' · ')}` : ''}</span>
            </span>
            <Icon name="chevronRight" className="chev" />
          </button>
        })}</div>
        <div style={{ height: 10 }} />
        <Button variant="tinted" icon="plus" onClick={addRoutine}>{t('New routine')}</Button>
      </section>
    </div>}
  </>
}
