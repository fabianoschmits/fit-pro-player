import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDialogFocus } from '../lib/dialog-focus.js'
import { t } from '../lib/i18n.js'

// Optional onAfterClose runs after unmount cleanup and, when owned, the pending
// sentinel traversal. Consumers must cancel deferred work when their context ends.
export default function Dialog({ open = true, title, onClose, onAfterClose, children, className = '', locked = false }) {
  const ref = useRef(null), titleId = useId(), closeRef = useRef(onClose), lockedRef = useRef(locked), afterCloseRef = useRef(onAfterClose), lifecycle = useRef(0)
  closeRef.current = onClose
  lockedRef.current = locked
  afterCloseRef.current = onAfterClose
  useDialogFocus(ref, { onClose: () => closeRef.current?.(), locked, titleId })
  useEffect(() => {
    const generation = ++lifecycle.current
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const openedAt = location.href
    let disposed = false, pushed = false
    // StrictMode's trial setup is cleaned up before this microtask. It must not
    // enqueue an asynchronous history.back that closes the real mounted dialog.
    queueMicrotask(() => {
      if (!disposed) { history.pushState({ ...history.state, fitProPlayerDialog: titleId }, ''); pushed = true }
    })
    let consumed = false
    const back = () => { consumed = true; if (!lockedRef.current) closeRef.current?.() }
    window.addEventListener('popstate', back)
    return () => {
      document.body.style.overflow = previous
      disposed = true
      window.removeEventListener('popstate', back)
      const afterClose = afterCloseRef.current
      const complete = () => queueMicrotask(() => { if (lifecycle.current === generation) afterClose?.() })
      if (pushed && !consumed && location.href === openedAt && history.state?.fitProPlayerDialog === titleId) {
        if (afterClose) window.addEventListener('popstate', complete, { once: true })
        history.back()
      } else if (afterClose) complete()
    }
  }, [titleId])
  if (!open) return null
  return createPortal(<div className="dialog-layer">
    <div className="dialog-backdrop" onClick={() => { if (!locked) onClose?.() }} />
    <section ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`dialog-surface ${className}`}>
      <header className="dialog-header"><h2 id={titleId}>{title}</h2><button type="button" className="dialog-close" aria-label={t('Close')} disabled={locked} onClick={onClose}>×</button></header>
      {children}
    </section>
  </div>, document.body)
}
