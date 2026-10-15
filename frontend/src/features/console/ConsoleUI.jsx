import { motion } from 'framer-motion'
import { Button } from '../../components/ui.jsx'
import { FppSkeleton } from '../../components/FppFeedback.jsx'
/* ── motion presets ──────────────────────────────────────── */
export const EASE = [0.32, 0.72, 0, 1]
export const SPRING = { type: 'spring', stiffness: 380, damping: 36 }
export const FADE = { duration: 0.22, ease: EASE }

/* ── data helpers ────────────────────────────────────────── */
const WEEK_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function fmtDate(v) {
  if (!v) return '—'
  try { return new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return String(v) }
}
export function fmtDateTime(v) {
  if (!v) return '—'
  try { return new Date(v).toLocaleString('pt-BR') } catch { return String(v) }
}

export function routineNameById(routines, id) {
  if (!id || id === 'rest') return id === 'rest' ? 'Descanso' : '—'
  return (routines || []).find(r => String(r.id) === String(id))?.name || `Rotina ${id}`
}
export function weekSchedule(training) {
  const week = training?.week || {}
  const routines = training?.routines || []
  return WEEK_LABELS.map((label, day) => {
    const id = week[String(day)] ?? week[day] ?? null
    return { day, label, name: id == null || id === '' ? null : routineNameById(routines, id) }
  })
}
export function workoutVolumePoints(workouts) {
  return (workouts || []).map(w => {
    if (!w?.d) return null
    const sets = (w.entries || []).reduce((s, e) => s + (e.sets || []).filter(x => x.done !== false).length, 0)
    const t = Date.parse(`${w.d}T12:00:00`)
    return Number.isFinite(t) ? { t, y: sets, d: w.d } : null
  }).filter(Boolean).sort((a, b) => a.t - b.t)
}
export function bodyweightPoints(rows) {
  return (rows || []).map(r => {
    const w = Number(r?.w)
    if (!r?.d || !Number.isFinite(w)) return null
    const t = Date.parse(`${r.d}T12:00:00`)
    return Number.isFinite(t) ? { t, y: w, d: r.d } : null
  }).filter(Boolean).sort((a, b) => a.t - b.t)
}

/* ── avatar initials ─────────────────────────────────────── */
export function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

export function Avatar({ name, size = 44 }) {
  return (
    <motion.div
      className="cx-avatar"
      style={{ '--sz': `${size}px` }}
      whileTap={{ scale: 0.95 }}
    >
      {initials(name)}
    </motion.div>
  )
}

/* ── chip ────────────────────────────────────────────────── */
const TONE_CLASS = { ok: 'ok', success: 'ok', warn: 'warn', warning: 'warn', err: 'err', error: 'err', neutral: '' }

export function Chip({ children, tone }) {
  const cls = TONE_CLASS[tone] || ''
  return <span className={`cx-chip${cls ? ` cx-chip--${cls}` : ''}`}>{children}</span>
}

/* ── kv pair ─────────────────────────────────────────────── */
export function Kv({ label, value }) {
  return (
    <div className="cx-kv">
      <dt className="cx-kv-label">{label}</dt>
      <dd className="cx-kv-value">{value ?? '—'}</dd>
    </div>
  )
}

/* ── metric card ─────────────────────────────────────────── */
export function MetricCard({ label, value, sub, accent, action, children }) {
  return (
    <motion.div className={`cx-metric-card${accent ? ' cx-metric-card--accent' : ''}`}
      whileTap={{ scale: 0.985 }} transition={SPRING}>
      <div className="cx-metric-top">
        <div>
          <div className="cx-metric-value">{value}</div>
          <div className="cx-metric-label">{label}</div>
          {sub && <div className="cx-metric-sub">{sub}</div>}
        </div>
        {action && <div className="cx-metric-action">{action}</div>}
      </div>
      {children}
    </motion.div>
  )
}

/* ── section title ───────────────────────────────────────── */
export function SectionTitle({ children, action }) {
  return (
    <div className="cx-section-title">
      <h2>{children}</h2>
      {action}
    </div>
  )
}

/* ── surface card ────────────────────────────────────────── */
export function SectionBody({ children, className = '' }) {
  return <div className={`console-section-body ${className}`.trim()}>{children}</div>
}

/* ── inline alert ─────────────────────────────────────────── */
export function Alert({ children, onRetry }) {
  return (
    <div className="cx-alert" role="alert">
      <span>{children}</span>
      {onRetry && <button type="button" className="cx-alert-retry" onClick={onRetry}>Tentar novamente</button>}
    </div>
  )
}

/* ── empty state ─────────────────────────────────────────── */
export function Empty({ title, sub }) {
  return (
    <div className="cx-empty">
      <div className="cx-empty-icon">—</div>
      <div className="cx-empty-title">{title}</div>
      {sub && <div className="cx-empty-sub">{sub}</div>}
    </div>
  )
}

/* ── loading dots ────────────────────────────────────────── */
export function Loading({ label = 'Carregando…' }) {
  return <FppSkeleton className="cx-loading" label={label} />
}

// Keep console styling while sharing the action lifetime and accessible signals.
export function CxButton(props) {
  return <Button appearance="custom" {...props} />
}
