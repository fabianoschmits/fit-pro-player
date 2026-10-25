import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function MetricInfoButton({ label, description, className = '', disabled = false }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(null)
  const id = useId()
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)

  const updatePosition = () => {
    const trigger = triggerRef.current
    const popover = popoverRef.current
    if (!trigger || !popover) return
    const rect = trigger.getBoundingClientRect()
    const width = popover.offsetWidth || 230
    const height = popover.offsetHeight || 52
    const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))
    const above = rect.top > height + 20
    setPosition({ left, top: above ? rect.top - 8 : rect.bottom + 8, above })
  }

  useLayoutEffect(() => {
    if (open) updatePosition()
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const closeOutside = event => {
      if (triggerRef.current?.contains(event.target) || popoverRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const closeWithEscape = event => { if (event.key === 'Escape') setOpen(false) }
    const reposition = () => updatePosition()
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeWithEscape)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeWithEscape)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  useEffect(() => {
    const closeWhenAnotherOpens = event => {
      if (event.detail !== id) setOpen(false)
    }
    document.addEventListener('metric-info-open', closeWhenAnotherOpens)
    return () => document.removeEventListener('metric-info-open', closeWhenAnotherOpens)
  }, [id])

  const toggle = () => {
    if (open) { setOpen(false); return }
    document.dispatchEvent(new CustomEvent('metric-info-open', { detail: id }))
    setOpen(true)
  }

  return <span className="metric-info">
    <button ref={triggerRef} type="button" className={`metric-info-trigger ${className}`.trim()} disabled={disabled} aria-expanded={open} onClick={toggle}>{label}</button>
    {open && typeof document !== 'undefined' && createPortal(<span ref={popoverRef} className={'metric-info-popover' + (position?.above ? ' is-above' : '')} role="tooltip" style={position ? { left: position.left, top: position.top } : { visibility: 'hidden' }}>{description}</span>, document.body)}
  </span>
}
