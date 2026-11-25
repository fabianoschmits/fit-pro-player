import AppHeader from '../../AppHeader.jsx'
import Icon from '../../Icon.jsx'
import { Button } from '../../ui.jsx'
import { t } from '../../../lib/i18n.js'
import { getPreviousWeek, getNextWeek } from '../../../lib/weekly-progress-calendar.js'
import { weeklyDate } from '../../../lib/weekly-progress-format.js'

export default function WeeklyProgressHeader({ summary, firstWeek, currentWeek, onSelect, backTo = '/progress', backState = undefined }) {
  const { period, days } = summary
  return <>
    <AppHeader title={t('Weekly summary')} subtitle={t('Track your progress each week.')} backTo={backTo} backState={backState} />
    <section className="weekly-selector" aria-label={t('Choose week')}>
      <div className="weekly-selector-row">
        <button type="button" className="iconbtn" aria-label={t('Previous week')} disabled={period.start <= firstWeek} onClick={() => onSelect(getPreviousWeek(period.start))}><Icon name="chevronLeft" /></button>
        <div><strong>{weeklyDate(period.start)} – {weeklyDate(days[6].date)}</strong><span>{t(period.isCurrentWeek ? 'Current week' : 'Previous week')}</span></div>
        <button type="button" className="iconbtn" aria-label={t('Next week')} disabled={period.isCurrentWeek} onClick={() => onSelect(getNextWeek(period.start))}><Icon name="chevronRight" /></button>
      </div>
      <label className="weekly-date-picker"><span>{t('Choose week')}</span><input type="date" aria-label={t('Choose week')} min={firstWeek} max={currentWeek} value={period.start} onChange={event => { if (event.target.value) onSelect(event.target.value) }} /></label>
      {!period.isCurrentWeek && <Button variant="ghost" size="sm" onClick={() => onSelect(currentWeek)}>{t('Back to current week')}</Button>}
    </section>
  </>
}
