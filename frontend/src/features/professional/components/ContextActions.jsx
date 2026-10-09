import { useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Dialog from '../../../components/Dialog.jsx'
import Icon from '../../../components/Icon.jsx'
import { useStore } from '../../../store/useStore.js'

// Selection runs after Dialog releases focus/body/history ownership. Router and
// account scope changes (or unmount) cancel the pending callback.
export default function ContextActions({ label, items = [] }) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const location = useLocation(), context = useRef(location), mounted = useRef(false), pending = useRef(null), closingRef = useRef(false)
  context.current = location
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; pending.current = null } }, [])
  const close = onSelect => {
    if (closingRef.current) return
    closingRef.current = true
    pending.current = { onSelect, location: context.current, href: window.location.href, scope: useStore.getState().getScopeToken() }
    setClosing(true); setOpen(false)
  }
  const afterClose = () => {
    if (!mounted.current || !closingRef.current) return
    const selected = pending.current
    pending.current = null; closingRef.current = false; setClosing(false)
    const sameEntry = selected && ['key', 'pathname', 'search', 'hash'].every(key => selected.location[key] === context.current[key])
    if (sameEntry && selected.href === window.location.href && useStore.getState().isScopeCurrent(selected.scope)) selected.onSelect?.()
  }
  return <>
    <button type="button" className="iconbtn professional-context-trigger" aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-disabled={closing} onClick={() => { if (!closingRef.current) setOpen(true) }}><Icon name="more" /></button>
    {open && <Dialog title={label} onClose={() => close()} onAfterClose={afterClose} className="professional-context-sheet">
      <div className="professional-context-items">{items.map(item => <button type="button" key={item.id} disabled={item.disabled} data-destructive={!!item.destructive} onClick={() => { if (!item.disabled) close(item.onSelect) }}>{item.label}</button>)}</div>
    </Dialog>}
  </>
}
