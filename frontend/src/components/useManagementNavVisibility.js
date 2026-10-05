import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

// Scroll only the local navigation, so a deep link never moves the page content.
export default function useManagementNavVisibility() {
  const ref = useRef(null)
  const { pathname } = useLocation()
  useEffect(() => {
    const nav = ref.current
    const active = nav?.querySelector('[aria-current="page"]')
    if (!active || nav.scrollWidth <= nav.clientWidth) return
    const bounds = nav.getBoundingClientRect()
    const selected = active.getBoundingClientRect()
    if (selected.left < bounds.left) nav.scrollLeft += selected.left - bounds.left
    else if (selected.right > bounds.right) nav.scrollLeft += selected.right - bounds.right
  }, [pathname])
  return ref
}
