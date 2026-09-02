import { useEffect, useRef, useState } from 'react'

/** Hide the bottom bar on scroll-down, show on scroll-up / top / idle — same behaviour as ConfiLar. */
export function useScrollDirection() {
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)
  const reappearTm = useRef(null)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      if (reappearTm.current) { clearTimeout(reappearTm.current); reappearTm.current = null }

      if (y <= 0) {
        setIsVisible(true)
        lastScrollY.current = y
        return
      }
      if (y > lastScrollY.current) setIsVisible(false)
      else if (y < lastScrollY.current) setIsVisible(true)
      lastScrollY.current = y

      reappearTm.current = setTimeout(() => setIsVisible(true), 3000)
    }

    let ticking = false
    const handler = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => { onScroll(); ticking = false })
    }

    window.addEventListener('scroll', handler, { passive: true })
    return () => {
      window.removeEventListener('scroll', handler)
      if (reappearTm.current) clearTimeout(reappearTm.current)
    }
  }, [])

  return isVisible
}
