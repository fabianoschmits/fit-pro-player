import { Children, cloneElement, isValidElement, useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Shared native-details motion for the existing workout panels. Controlled and
// automatic closures follow the same path as pointer/keyboard summary activation.
export default function AnimatedDetails({ children, className = '', open = undefined, onOpenChange = undefined,
  elementRef = undefined, initialHeightRef = undefined, onExpanded = undefined, ...props }) {
  const localRef = useRef(null)
  const detailsRef = elementRef || localRef
  const animationRef = useRef(null)
  const initialized = useRef(false)
  const expandedCallback = useRef(onExpanded)
  expandedCallback.current = onExpanded
  const [internalOpen, setInternalOpen] = useState(false)
  const expanded = open ?? internalOpen
  const reducedMotion = useReducedMotion()
  useLayoutEffect(() => {
    const details = detailsRef.current
    if (!details) return
    const from = initialHeightRef?.current ?? details.getBoundingClientRect().height
    if (initialHeightRef) initialHeightRef.current = null
    animationRef.current?.cancel()
    details.toggleAttribute('open', expanded)
    const to = details.getBoundingClientRect().height
    const complete = () => { if (expanded) expandedCallback.current?.() }
    if (!initialized.current || reducedMotion || !details.animate || from === to) {
      initialized.current = true
      complete()
      return
    }
    details.setAttribute('open', '')
    details.style.overflow = 'hidden'
    const animation = details.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both',
    })
    animationRef.current = animation
    void animation.finished.then(() => {
      if (animationRef.current !== animation) return
      details.toggleAttribute('open', expanded)
      animation.cancel()
      details.style.overflow = ''
      animationRef.current = null
      complete()
    }).catch(() => {})
    return () => { animation.cancel(); details.style.overflow = '' }
  }, [detailsRef, expanded, initialHeightRef, reducedMotion])
  const items = Children.toArray(children)
  const summary = /** @type {import('react').ReactElement<import('react').HTMLAttributes<HTMLElement>> | undefined} */ (
    items.find(child => isValidElement(child) && child.type === 'summary')
  )
  return <details {...props} ref={detailsRef} className={`animated-details ${className}`} data-expanded={expanded}>
    {summary && cloneElement(summary, { 'aria-expanded': expanded, onClick: event => {
      summary.props.onClick?.(event)
      if (event.defaultPrevented) return
      event.preventDefault()
      if (open === undefined) setInternalOpen(!expanded)
      onOpenChange?.(!expanded)
    } })}
    <div className="animated-details-body" inert={!expanded} aria-hidden={!expanded}>{items.filter(child => child !== summary)}</div>
  </details>
}
