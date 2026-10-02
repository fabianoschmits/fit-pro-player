import { useLayoutEffect, useRef } from 'react'

const FOCUSABLE = 'button:not(:disabled),a[href],input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'
const stack = []
const locks = new WeakMap()

function isolate(element) {
  const siblings = []
  for (let branch = element; branch?.parentElement; branch = branch.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (sibling === branch || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) continue
      const lock = locks.get(sibling) || { count: 0, inert: sibling.hasAttribute('inert'), hidden: sibling.getAttribute('aria-hidden') }
      lock.count++; locks.set(sibling, lock)
      sibling.setAttribute('inert', ''); sibling.setAttribute('aria-hidden', 'true'); siblings.push(sibling)
    }
    if (branch.parentElement === document.body) break
  }
  return () => siblings.forEach(sibling => {
    const lock = locks.get(sibling)
    if (!lock || --lock.count) return
    if (!lock.inert) sibling.removeAttribute('inert')
    if (lock.hidden === null) sibling.removeAttribute('aria-hidden'); else sibling.setAttribute('aria-hidden', lock.hidden)
    locks.delete(sibling)
  })
}

export function useDialogFocus(ref, { active = true, onClose, locked = false, titleId } = {}) {
  const closeRef = useRef(onClose); closeRef.current = onClose
  const lockedRef = useRef(locked); lockedRef.current = locked
  useLayoutEffect(() => {
    const surface = ref.current
    if (!surface || !active) return
    const trigger = document.activeElement
    const title = surface.querySelector('h1,h2,h3,[data-dialog-title]')
    if (title && !surface.hasAttribute('aria-label')) {
      if (!title.id) title.id = titleId
      surface.setAttribute('aria-labelledby', title.id)
    }
    if (!title && !surface.hasAttribute('aria-label') && !surface.hasAttribute('aria-labelledby')) surface.setAttribute('aria-label', 'Fit Pro Player')
    const release = isolate(surface)
    stack.push(surface)
    const focusables = () => [...surface.querySelectorAll(FOCUSABLE)].filter(el => !el.closest('[inert],[hidden],[aria-hidden="true"]'))
    const initial = surface.querySelector('[autofocus]') || focusables()[0] || surface
    initial.focus?.({ preventScroll: true })
    const key = event => {
      if (stack.at(-1) !== surface) return
      if (event.key === 'Escape' && !lockedRef.current && closeRef.current) {
        event.preventDefault(); event.stopPropagation(); closeRef.current(); return
      }
      if (event.key !== 'Tab') return
      const nodes = focusables(), first = nodes[0] || surface, last = nodes.at(-1) || surface
      if (!nodes.length || (event.shiftKey && (document.activeElement === first || document.activeElement === surface)) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus?.()
      }
    }
    const focus = event => {
      if (stack.at(-1) === surface && !surface.contains(event.target)) (focusables()[0] || surface).focus?.()
    }
    document.addEventListener('keydown', key, true); document.addEventListener('focusin', focus)
    return () => {
      document.removeEventListener('keydown', key, true); document.removeEventListener('focusin', focus)
      const wasTop = stack.at(-1) === surface
      const index = stack.indexOf(surface); if (index >= 0) stack.splice(index, 1)
      release()
      if (wasTop) {
        const target = trigger?.isConnected && !trigger.closest?.('[inert]') ? trigger : stack.at(-1)
        target?.focus?.({ preventScroll: true })
      }
    }
  }, [ref, active, titleId])
}
