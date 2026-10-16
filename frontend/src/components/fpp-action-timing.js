export const FPP_ACTIVATION_MS = 320
export const FPP_CONFIRM_MS = 520

export function fppActionInput(event) {
  if (event?.fppInput) return event.fppInput
  if (event?.type === 'submit') {
    const submitter = event.nativeEvent?.submitter || event.submitter
    return submitter?.dataset.input || 'keyboard'
  }
  if (event?.type === 'click') return event.detail > 0 ? 'pointer' : 'keyboard'
  return 'pointer'
}

export function shouldAnimateFppAction(event) {
  return fppActionInput(event) !== 'keyboard' && !(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  )
}

export function waitForFppConfirmation(event, { signal } = {}) {
  if (signal?.aborted) return Promise.resolve(false)
  if (!shouldAnimateFppAction(event)) return Promise.resolve(true)
  return new Promise(resolve => {
    const finish = completed => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      resolve(completed)
    }
    const abort = () => finish(false)
    const timer = setTimeout(() => finish(true), FPP_CONFIRM_MS)
    signal?.addEventListener('abort', abort, { once: true })
  })
}
