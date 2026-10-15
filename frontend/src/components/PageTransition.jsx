import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { MOBILE } from '../lib/mobile.js'

const EASE = [0.32, 0.72, 0, 1]
const MOBILE_LIKE = MOBILE || (typeof window !== 'undefined' && (
  window.matchMedia?.('(pointer: coarse)').matches ||
  (navigator.maxTouchPoints || 0) > 0
))

export default function PageTransition({ children }) {
  const loc = useLocation()
  const reduced = useReducedMotion()
  // Workspaces own their navigation. Keep the shell mounted so an outgoing
  // animation cannot duplicate the destination's form or steal input focus.
  const workspace = /^\/(console|professional|professional-profile|student\/professionals|invite|connect)(\/|$)/.exec(loc.pathname)?.[1]
  const pageKey = workspace ? (['invite', 'connect', 'student/professionals'].includes(workspace) ? '/student/professionals' : workspace === 'professional-profile' ? '/professional' : `/${workspace}`) : loc.pathname

  // A retained outgoing Routes tree also reads the current router location.
  // Keep one surface on touch devices and with reduced motion so navigation
  // never mounts duplicate destination forms or competing action handlers.
  if (MOBILE_LIKE || reduced) return <div id="app">{children}</div>

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        id="app"
        key={pageKey}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12, ease: EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
