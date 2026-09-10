import { useMemo, useState } from 'react'
import { fmtDur, fmtVol, isoOf, todayISO, MONTHS_LONG } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

// Monthly activity heatmap, shaded by time trained per day.
export default function Heatmap({ S, onDay }) {
  const [monthOffset, setMonthOffset] = useState(0)
  const { agg, thresholds } = useMemo(() => {
    const byDay = {}
    S.workouts.forEach(w => {
      const a = byDay[w.d] = byDay[w.d] || { n: 0, vol: 0, min: 0 }
      a.n++; a.vol += w.vol || 0
      a.min += Math.max(0, Math.round(((w.end || w.start) - w.start) / 60000))
    })
    const mins = Object.values(byDay).map(a => a.min).filter(v => v > 0).sort((a, b) => a - b)
    const q = p => (mins.length ? mins[Math.min(mins.length - 1, Math.floor(p * mins.length))] : 0)
    return { agg: byDay, thresholds: [q(0.25), q(0.5), q(0.75)] }
  }, [S.workouts])
  const [t1, t2, t3] = thresholds
  const level = a => !a ? 0 : !a.min ? 1 : a.min >= t3 ? 4 : a.min >= t2 ? 3 : a.min >= t1 ? 2 : 1

  const today = new Date(); today.setHours(12, 0, 0, 0)
  const shown = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1, 12)
  const year = shown.getFullYear()
  const month = shown.getMonth()
  const monthStart = new Date(year, month, 1, 12)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = (monthStart.getDay() + 6) % 7
  const monthKeys = Array.from({ length: daysInMonth }, (_, i) => isoOf(new Date(year, month, i + 1, 12)))
  const monthAgg = monthKeys.map(key => agg[key]).filter(Boolean)
  const monthMinutes = monthAgg.reduce((sum, a) => sum + a.min, 0)
  const monthVolume = monthAgg.reduce((sum, a) => sum + a.vol, 0)
  const canGoNext = monthOffset < 0

  const cells = []
  for (let i = 0; i < lead; i++) cells.push(<div key={'e' + i} className="hm-c hm-empty" />)
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month, d, 12)
    const key = isoOf(day)
    const a = agg[key]
    const future = day > today
    const cls = 'hm-c hm-day l' + level(a) + (key === todayISO() ? ' today' : '') + (future ? ' future' : '')
    cells.push(<button key={key} type="button" className={cls}
      title={key + (a ? ` · ${t(a.n === 1 ? '{0} workout' : '{0} workouts', a.n)} · ${a.min} min · ${fmtVol(a.vol, S.unit)}` : '')}
      disabled={!a || future} onClick={() => onDay(key)}><span>{d}</span></button>)
  }
  while (cells.length % 7) cells.push(<div key={'f' + cells.length} className="hm-c hm-empty" />)

  return <>
    <div className="hm-wrap">
      <div className="hm-month-head">
        <button className="iconbtn" onClick={() => setMonthOffset(v => v - 1)} aria-label={t('Previous month')} title={t('Previous month')}><Icon name="chevronLeft" /></button>
        <div className="hm-month-title">
          <strong>{t(MONTHS_LONG[month])} {year}</strong>
          <span>{monthAgg.length ? `${t(monthAgg.length === 1 ? '{0} workout' : '{0} workouts', monthAgg.length)} · ${fmtDur(monthMinutes * 60000)} · ${fmtVol(monthVolume, S.unit)}` : t('No workouts this month')}</span>
        </div>
        <button className="iconbtn" disabled={!canGoNext} onClick={() => setMonthOffset(v => Math.min(0, v + 1))} aria-label={t('Next month')} title={t('Next month')}><Icon name="chevronRight" /></button>
      </div>
      <div className="hm-weekdays">{['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => <span key={day}>{t(day)}</span>)}</div>
      <div className="hm-month-grid">{cells}</div>
    </div>
    <div className="hm-legend">{t('Less time')} <div className="hm-c l0" /><div className="hm-c l1" /><div className="hm-c l2" /><div className="hm-c l3" /><div className="hm-c l4" /> {t('More time')}</div>
  </>
}
