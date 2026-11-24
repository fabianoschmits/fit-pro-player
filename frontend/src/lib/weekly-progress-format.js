import { dateLocale, t } from './i18n-core.js'
import { getWeekStart } from './weekly-progress-calendar.js'
export const weeklyHref = (date = undefined, timeZone = undefined) => '/progress/weekly' + (date == null ? '' : `?week=${getWeekStart(date, timeZone)}`)
export const weeklyNumber = value => value == null ? '—' : new Intl.NumberFormat(dateLocale(), { maximumFractionDigits: 2 }).format(value)
export const weeklyDate = (date, options = {}) => new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'short', ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
export function weeklyDuration(seconds) {
  if (seconds == null) return t('Not recorded')
  const minutes = Math.round(seconds / 60), hours = Math.floor(minutes / 60)
  const unit = (value, name) => new Intl.NumberFormat(dateLocale(), { style: 'unit', unit: name, unitDisplay: 'short' }).format(value)
  return hours ? `${unit(hours, 'hour')} ${unit(minutes % 60, 'minute')}` : unit(minutes, 'minute')
}
export function weeklyDelta(delta, duration = false) {
  if (!delta?.comparable) return '—'
  if (delta.absolute === 0) return t('No change')
  return `${delta.absolute > 0 ? '+' : '−'}${duration ? weeklyDuration(Math.abs(delta.absolute)) : weeklyNumber(Math.abs(delta.absolute))}`
}
