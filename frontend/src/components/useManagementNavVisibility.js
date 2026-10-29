import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

// Scroll only the local navigation, so a deep link never moves the page content.
export default function useManagementNavVisibility(dependency = null) {
  const ref = useRef(null)
  const { pathname, search } = useLocation()
  useEffect(() => {
    const nav = ref.current
    if (!nav) return
    const revealActive = () => {
      const active = nav.querySelector('[aria-current="page"]')
      if (!active || nav.scrollWidth <= nav.clientWidth) return
      const bounds = nav.getBoundingClientRect()
      const selected = active.getBoundingClientRect()
      if (selected.left < bounds.left) nav.scrollLeft += selected.left - bounds.left
      else if (selected.right > bounds.right) nav.scrollLeft += selected.right - bounds.right
    }
    revealActive()
    const observer = new MutationObserver(revealActive)
    observer.observe(nav, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-current'] })
    return () => observer.disconnect()
  }, [pathname, search, dependency])
  return ref
}
