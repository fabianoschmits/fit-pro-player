// iOS Home Screen apps use the system web-app shell even when installed by
// Chrome, so their UA may no longer contain CriOS. Detect that shell as well.
export function installPwaViewport({ native = false } = {}) {
  const displayMode = window.matchMedia('(display-mode: standalone)')
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const chromeMobile = /Android|iPhone|iPad|iPod/.test(ua) && /(?:Chrome|CriOS)\//.test(ua)
    && !/EdgA?\/|EdgiOS\/|OPR\/|SamsungBrowser\//.test(ua)
  const update = () => {
    const installed = displayMode.matches || navigator.standalone === true
    const mode = !native && installed && (ios ? 'ios' : chromeMobile ? 'chrome' : null)
    if (mode) document.documentElement.dataset.pwaViewport = mode
    else delete document.documentElement.dataset.pwaViewport
  }
  update()
  displayMode.addEventListener('change', update)
  return () => displayMode.removeEventListener('change', update)
}
