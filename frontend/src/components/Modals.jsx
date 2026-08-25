import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useUI } from '../store/useUI.js'

const EXIT_MS = 180

// Keep removed sheets mounted just long enough to complete their exit. The store
// remains the source of truth, so history/back accounting is still immediate.
function useSheetPresence(sheets) {
  const [rendered, setRendered] = useState(sheets)
  const timers = useRef(new Map())

  useLayoutEffect(() => {
    const liveIds = new Set(sheets.map(sheet => sheet.id))
    setRendered(previous => {
      const alreadyExiting = previous.filter(sheet => sheet.exiting && !liveIds.has(sheet.id))
      const justRemoved = previous.filter(sheet => !sheet.exiting && !liveIds.has(sheet.id))
        .map(sheet => ({ ...sheet, exiting: true }))

      for (const sheet of justRemoved) {
        if (timers.current.has(sheet.id)) continue
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        const timer = setTimeout(() => {
          timers.current.delete(sheet.id)
          setRendered(current => current.filter(item => item.id !== sheet.id))
        }, reduce ? 0 : EXIT_MS)
        timers.current.set(sheet.id, timer)
      }

      return [...alreadyExiting, ...justRemoved, ...sheets.map(sheet => ({ ...sheet, exiting: false }))]
    })
  }, [sheets])

  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer)
    timers.current.clear()
  }, [])

  return rendered
}

// One bottom sheet (or centered dialog) with swipe-to-dismiss.
function Sheet({ sheet, exiting }) {
  const { closeSheet } = useUI()
  const ref = useRef(null)
  const drag = useRef({ startY: null, delta: 0, startedAt: 0, kind: null })

  const onTouchStart = e => {
    const el = ref.current
    // a gesture that begins on a slider (or opted-out control) belongs to that control,
    // not to the sheet's swipe-to-dismiss — so it keeps working while you drag
    if (e.target.closest && e.target.closest('input[type=range], [data-nodrag]')) {
      drag.current = { startY: null, delta: 0, startedAt: 0, kind: null }
      return
    }
    drag.current = { startY: el.scrollTop <= 0 ? e.touches[0].clientY : null, delta: 0, startedAt: Date.now(), kind: 'touch' }
  }
  const onTouchMove = e => {
    const el = ref.current, d = drag.current
    if (d.startY === null) return
    d.delta = e.touches[0].clientY - d.startY
    if (d.delta > 0 && el.scrollTop <= 0) {
      e.preventDefault()
      el.style.transition = 'none'
      el.style.transform = `translateY(${d.delta}px)`
    } else d.delta = 0
  }
  const onTouchEnd = () => {
    const el = ref.current, d = drag.current
    if (d.startY === null) return
    const velocity = d.delta / Math.max(1, Date.now() - d.startedAt)
    el.style.transition = 'transform var(--fast) var(--ease)'
    if ((d.delta > 90 || (d.kind === 'touch' && d.delta > 28 && velocity > 0.65)) && !sheet.locked) {
      el.style.setProperty('--sheet-drag', d.delta + 'px')
      closeSheet(sheet.id)
    } else el.style.transform = ''
    d.startY = null
  }
  // Mouse drag (desktop testing / trackpads): same swipe-to-dismiss behaviour.
  const onMouseDown = e => {
    if (e.button !== 0) return
    if (e.target.closest && e.target.closest('input[type=range], [data-nodrag]')) {
      drag.current = { startY: null, delta: 0, startedAt: 0, kind: null }
      return
    }
    const el = ref.current
    drag.current = { startY: el.scrollTop <= 0 ? e.clientY : null, delta: 0, startedAt: Date.now(), kind: 'mouse' }
  }
  const onMouseMove = e => {
    const el = ref.current, d = drag.current
    if (d.startY === null) return
    d.delta = e.clientY - d.startY
    if (d.delta > 0 && el.scrollTop <= 0) {
      e.preventDefault()
      el.style.transition = 'none'
      el.style.transform = `translateY(${d.delta}px)`
    } else d.delta = 0
  }
  const onMouseUp = () => onTouchEnd()
  const onKeyDown = e => {
    if (e.key !== 'Tab') return
    const surface = ref.current
    const focusable = [...surface.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.closest('[aria-hidden="true"]'))
    if (!focusable.length) { e.preventDefault(); return }
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === surface)) {
      e.preventDefault(); last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus()
    }
  }

  // non-passive touchmove so preventDefault works (bottom sheets only; centered dialogs have no ref)
  useEffect(() => {
    const el = ref.current
    if (!el || sheet.kind === 'center') return
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      el.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useEffect(() => {
    if (!exiting) ref.current?.focus?.({ preventScroll: true })
  }, [exiting])

  const close = () => closeSheet(sheet.id)
  if (sheet.kind === 'center') {
    return (
      <div className={'modal-layer' + (exiting ? ' is-closing' : '')}>
        <div className="mback" onClick={() => { if (!sheet.locked) close() }} />
        <div className="center" ref={ref} role="dialog" aria-modal="true" tabIndex="-1" onKeyDown={onKeyDown}>{sheet.render(close)}</div>
      </div>
    )
  }
  return (
    <div className={'modal-layer' + (exiting ? ' is-closing' : '')}>
      <div className="mback" onClick={() => { if (!sheet.locked) close() }} />
      <div className="sheet" ref={ref} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        role="dialog" aria-modal="true" tabIndex="-1" onKeyDown={onKeyDown}>
        <div className="grab" />
        {sheet.render(close)}
      </div>
    </div>
  )
}

export default function Modals() {
  const sheets = useUI(s => s.sheets)
  const renderedSheets = useSheetPresence(sheets)
  const closeSheet = useUI(s => s.closeSheet)
  const prevLen = useRef(0)
  const suppressPop = useRef(false)
  const pushedEntries = useRef(0)
  const sheetEntries = useRef([])

  // Every opened sheet gets a history entry so Android back dismisses it instead of
  // leaving the page (issue #63). Keep the pushed-entry count and each active sheet's
  // live-entry status explicit: sheet count cannot tell whether popstate already spent
  // an entry (especially for a locked sheet) or whether several sheets opened at once.
  useEffect(() => {
    const prev = prevLen.current
    prevLen.current = sheets.length
    if (sheets.length > prev) {
      for (let i = prev; i < sheets.length; i++) {
        sheetEntries.current.push({ openedAt: location.href, live: true })
        history.pushState({ fitProPlayerSheet: true }, '')
        pushedEntries.current++
      }
    } else if (sheets.length < prev) {
      const closedEntries = sheetEntries.current.splice(sheets.length, prev - sheets.length)
      const rewind = closedEntries.filter(entry =>
        entry.live && !(typeof entry.openedAt === 'string' && location.href !== entry.openedAt)).length
      if (rewind > 0) {
        pushedEntries.current = Math.max(0, pushedEntries.current - rewind)
        suppressPop.current = true
        history.go(-rewind)
      }
      // Entries skipped because the app moved on remain in pushedEntries as deliberate
      // leaks until a later popstate consumes them with no corresponding active sheet.
    }
  }, [sheets.length])

  useEffect(() => {
    const onPop = () => {
      if (suppressPop.current) { suppressPop.current = false; return }
      if (pushedEntries.current <= 0) return
      pushedEntries.current--
      // The browser has already spent one pushed entry. Mark the latest live active
      // sheet entry spent even when the sheet is locked; with no active entry this is a
      // moved-on leak, which is still accounted for by the counter decrement above.
      for (let i = sheetEntries.current.length - 1; i >= 0; i--) {
        if (sheetEntries.current[i].live) {
          sheetEntries.current[i].live = false
          break
        }
      }
      const top = sheets[sheets.length - 1]
      if (top && !top.locked) closeSheet(top.id)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [sheets, closeSheet])

  // lock the page behind any open sheet (iOS-safe)
  useEffect(() => {
    if (!sheets.length) return
    const onKey = e => { if (e.key === 'Escape') { const top = useUI.getState().sheets[useUI.getState().sheets.length - 1]; if (top && !top.locked) useUI.getState().closeSheet(top.id) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheets.length])
  useEffect(() => {
    if (!sheets.length) return
    const y = window.scrollY || 0
    const b = document.body.style
    b.position = 'fixed'; b.top = -y + 'px'; b.left = '0'; b.right = '0'; b.width = '100%'
    return () => {
      b.position = b.top = b.left = b.right = b.width = ''
      window.scrollTo(0, y)
    }
  }, [sheets.length > 0])

  if (!renderedSheets.length) return null
  return (
    <div id="modal-root" className="open">
      {renderedSheets.map(s => <Sheet key={s.id} sheet={s} exiting={s.exiting} />)}
    </div>
  )
}
