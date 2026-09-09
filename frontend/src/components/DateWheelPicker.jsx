import { useEffect, useMemo, useRef } from 'react'
import { dateLocale, t } from '../lib/i18n.js'
import { dateFromParts, dateParts, daysInMonth, defaultBirthDate } from '../lib/profile.js'

const ITEM_HEIGHT = 44

function WheelColumn({ label, items, value, onChange, reducedMotion }) {
  const ref = useRef(null)
  const timer = useRef(null)

  const align = (nextValue, smooth = false) => {
    const index = Math.max(0, items.findIndex(item => item.value === nextValue))
    const top = index * ITEM_HEIGHT
    const node = ref.current
    if (!node) return
    if (typeof node.scrollTo === 'function') node.scrollTo({ top, behavior: smooth && !reducedMotion ? 'smooth' : 'auto' })
    else node.scrollTop = top
  }

  useEffect(() => {
    align(value)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // `items` changes only when the valid day count changes; length captures that without
    // realigning for every render-created array reference.
  }, [value, items.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const settle = event => {
    const node = event.currentTarget
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const index = Math.max(0, Math.min(items.length - 1, Math.round(node.scrollTop / ITEM_HEIGHT)))
      const next = items[index]?.value
      if (next != null && next !== value) onChange(next)
      align(next)
    }, 90)
  }

  const step = delta => {
    const index = Math.max(0, items.findIndex(item => item.value === value))
    const next = items[Math.max(0, Math.min(items.length - 1, index + delta))]?.value
    if (next == null || next === value) return
    onChange(next)
    align(next, true)
  }

  return <div className="date-wheel-column" role="listbox" aria-label={label} tabIndex={0}
    onScroll={settle}
    onKeyDown={event => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
      event.preventDefault()
      step(event.key === 'ArrowUp' ? -1 : 1)
    }} ref={ref}>
    {items.map(item => <button type="button" role="option" aria-selected={item.value === value}
      tabIndex={-1} key={item.value} className={item.value === value ? 'selected' : ''}
      onClick={() => { onChange(item.value); align(item.value, true) }}>
      {item.label}
    </button>)}
  </div>
}

export default function DateWheelPicker({ value, onChange, max = '', reducedMotion = false }) {
  const maxDate = max || new Date().toISOString().slice(0, 10)
  const selected = dateParts(value, defaultBirthDate())
  const maxParts = dateParts(maxDate, maxDate)
  const locale = dateLocale()
  const years = useMemo(() => Array.from({ length: maxParts.year - 1899 }, (_, index) => {
    const year = 1900 + index
    return { value: year, label: String(year) }
  }), [maxParts.year])
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const date = new Date(2024, index, 1)
    const raw = new Intl.DateTimeFormat(locale, { month: 'short' }).format(date).replace('.', '')
    return { value: index + 1, label: raw.charAt(0).toLocaleUpperCase(locale) + raw.slice(1) }
  }), [locale])
  const days = useMemo(() => Array.from({ length: daysInMonth(selected.year, selected.month) }, (_, index) => ({
    value: index + 1, label: String(index + 1).padStart(2, '0')
  })), [selected.month, selected.year])

  const commit = patch => {
    let next = dateFromParts({ ...selected, ...patch })
    if (next > maxDate) next = maxDate
    if (next < '1900-01-01') next = '1900-01-01'
    onChange(next)
  }

  const spoken = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${dateFromParts(selected)}T12:00:00`))

  return <div className="date-wheel-wrap">
    <div className="date-wheel" aria-describedby="date-wheel-value">
      <WheelColumn label={t('Day')} items={days} value={selected.day} onChange={day => commit({ day })} reducedMotion={reducedMotion} />
      <WheelColumn label={t('Month')} items={months} value={selected.month} onChange={month => commit({ month })} reducedMotion={reducedMotion} />
      <WheelColumn label={t('Year')} items={years} value={selected.year} onChange={year => commit({ year })} reducedMotion={reducedMotion} />
    </div>
    <span id="date-wheel-value" className="sr-only" aria-live="polite">{t('Selected date: {0}', spoken)}</span>
  </div>
}
