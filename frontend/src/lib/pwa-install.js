// Browser capability decides whether we can show a prompt. UA detection is only
// a convenience for selecting manual instructions, never an installation gate.
export function detectInstallTarget(nav = globalThis.navigator || {}) {
  const ua = nav.userAgent || ''
  const ios = /iPhone|iPad|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  const platform = ios ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop'
  const browser = /SamsungBrowser\//.test(ua) ? 'samsung'
    : /Edg(?:A|iOS)?\//.test(ua) ? 'edge'
      : /OPR\/|OPiOS\/|Opera\//.test(ua) ? 'opera'
        : /Firefox\/|FxiOS\//.test(ua) ? 'firefox'
          : /Chrome\/|CriOS\//.test(ua) ? 'chrome'
            : /Safari\//.test(ua) ? 'safari' : 'other'
  return { platform, browser }
}

export function createPwaInstaller(scope) {
  const listeners = new Set()
  let deferred = null
  let stop = null
  let snapshot = { canInstall: false, installed: false, status: 'idle' }
  const publish = patch => {
    snapshot = { ...snapshot, ...patch }
    listeners.forEach(listener => listener())
  }
  const installed = () => {
    deferred = null
    publish({ canInstall: false, installed: true, status: 'installed' })
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    start: () => {
      if (stop) return stop
      if (!scope) return () => {}
      // Our manifest uses standalone. A fullscreen browser tab is not evidence
      // that the app was installed (for example, after pressing F11).
      const media = scope.matchMedia?.('(display-mode: standalone)')
      const detectInstalled = () => {
        if (scope.navigator.standalone === true || media?.matches) installed()
      }
      const offer = event => {
        if (snapshot.installed || typeof event.prompt !== 'function') return
        event.preventDefault()
        deferred = event
        publish({ canInstall: true, status: 'ready' })
      }
      scope.addEventListener('beforeinstallprompt', offer)
      scope.addEventListener('appinstalled', installed)
      media?.addEventListener?.('change', detectInstalled)
      detectInstalled()
      stop = () => {
        scope.removeEventListener('beforeinstallprompt', offer)
        scope.removeEventListener('appinstalled', installed)
        media?.removeEventListener?.('change', detectInstalled)
        stop = null
      }
      return stop
    },
    install: async () => {
      if (!deferred || snapshot.installed || snapshot.status === 'prompting') return
      const event = deferred
      deferred = null // Each browser offer is single-use, including cancellation.
      publish({ canInstall: false, status: 'prompting' })
      try {
        // Must happen synchronously within the user's click, before any await.
        const result = await event.prompt()
        const choice = event.userChoice ? await event.userChoice : result
        if (!snapshot.installed && !deferred) publish({ status: choice?.outcome === 'accepted' ? 'accepted' : 'dismissed' })
      } catch {
        if (!snapshot.installed && !deferred) publish({ status: 'error' })
      }
    },
  }
}

export const pwaInstaller = createPwaInstaller(typeof window === 'undefined' ? null : window)
