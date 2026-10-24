import { useState } from 'react'

export default function MetricInfoButton({ label, description, className = '', disabled = false }) {
  const [open, setOpen] = useState(false)
  return <span className="metric-info">
    <button type="button" className={`metric-info-trigger ${className}`.trim()} disabled={disabled} aria-expanded={open} onClick={event => { event.stopPropagation(); setOpen(value => !value) }}>{label}</button>
    {open && <span className="metric-info-popover" role="tooltip">{description}</span>}
  </span>
}
