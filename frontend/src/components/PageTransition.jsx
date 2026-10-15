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

  return (
    <AnimatePresence mode={MOBILE_LIKE ? 'sync' : 'wait'} initial={false}>
      <motion.div
        id="app"
        key={pageKey}
        initial={reduced ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        // WKWebView can leave the outgoing page mounted without completing its
        // exit animation. Keeping the old page visible until the new route is
        // ready can otherwise leave the app shell black and unresponsive.
        exit={MOBILE_LIKE || reduced ? undefined : { opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.12, ease: EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
