import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { MOBILE } from '../lib/mobile.js'

const EASE = [0.32, 0.72, 0, 1]

export default function PageTransition({ children }) {
  const loc = useLocation()
  const reduced = useReducedMotion()

  return (
    <AnimatePresence mode={MOBILE ? 'sync' : 'wait'} initial={false}>
      <motion.div
        id="app"
        key={loc.pathname}
        initial={reduced ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        // WKWebView can leave the outgoing page mounted without completing its
        // exit animation. Keeping the old page visible until the new route is
        // ready can otherwise leave the app shell black and unresponsive.
        exit={MOBILE || reduced ? undefined : { opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.12, ease: EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
