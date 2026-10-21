import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

export default function PageTransition({ children }) {
  const { pathname } = useLocation()
  const [reduced, setReduced] = useState(() => window.matchMedia?.(REDUCED_MOTION).matches ?? false)
  const surface = useRef(null)
  const previousPath = useRef(pathname)
  const keyboard = useRef(false)

  useEffect(() => {
    const preference = window.matchMedia?.(REDUCED_MOTION)
    if (!preference) return
    const update = () => setReduced(preference.matches)
    update()
    if (preference.addEventListener) {
      preference.addEventListener('change', update)
      return () => preference.removeEventListener('change', update)
    }
    preference.addListener?.(update)
    return () => preference.removeListener?.(update)
  }, [])

  useEffect(() => {
    const onKeyboard = () => { keyboard.current = true }
    const onPointer = () => { keyboard.current = false }
    document.addEventListener('keydown', onKeyboard, true)
    document.addEventListener('pointerdown', onPointer, true)
    return () => {
      document.removeEventListener('keydown', onKeyboard, true)
      document.removeEventListener('pointerdown', onPointer, true)
    }
  }, [])

  useLayoutEffect(() => {
    const changed = previousPath.current !== pathname
    previousPath.current = pathname
    const element = surface.current
    if (!changed || reduced || keyboard.current || !element?.animate) return

    let animation
    let pending
    const enter = () => {
      if (element.querySelector('[data-route-loading]')) return false
      if (keyboard.current || window.matchMedia?.(REDUCED_MOTION).matches) return true
      // Fullscreen chat owns its stacking above the dock. An opacity animation
      // on its ancestor would briefly put that fixed surface behind the menu.
      if (!element.querySelector('.chat-page')) {
        animation = element.animate([{ opacity: 0.65 }, { opacity: 1 }], {
          duration: 180,
          easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
        })
      }
      return true
    }

    // Fade the resolved page rather than a temporary lazy-route skeleton.
    if (!enter()) {
      pending = new MutationObserver(() => { if (enter()) pending.disconnect() })
      pending.observe(element, { childList: true, subtree: true })
    }
    return () => {
      pending?.disconnect()
      animation?.cancel()
    }
  }, [pathname, reduced])

  // One live route tree keeps forms, focus and workspace state intact. There
  // is no outgoing copy, navigation delay, or transform on fixed descendants.
  return <div id="app" ref={surface}>{children}</div>
}
