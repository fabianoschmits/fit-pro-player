import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const EASE = [0.32, 0.72, 0, 1]

export default function PageTransition({ children }) {
  const loc = useLocation()
  const reduced = useReducedMotion()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        id="app"
        key={loc.pathname}
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? undefined : { opacity: 0, y: -6 }}
        transition={{ duration: reduced ? 0 : 0.32, ease: EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
