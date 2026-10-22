import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { detectInstallTarget, pwaInstaller } from '../lib/pwa-install.js'
import {
  dismissPwaInstallForever,
  shouldShowPwaInstallPrompt,
  snoozePwaInstall,
} from '../lib/pwa-install-prompt.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import Icon from './Icon.jsx'
import { Button, Segmented } from './ui.jsx'
import { BrowserGuide, GUIDES, PLATFORM_LABELS, installStatus } from './PwaInstallGuide.jsx'
import './pwa-install-guide.css'
import './pwa-install-prompt.css'

const PLATFORMS = [
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
  { value: 'desktop', label: 'PC' },
]

const DEFAULT_BROWSER = { ios: 'safari', android: 'chrome', desktop: 'chrome' }

function PwaInstallSheet({ close }) {
  const update = useStore(s => s.update)
  const settled = useRef(false)
  const [target] = useState(() => detectInstallTarget())
  const [platform, setPlatform] = useState(target.platform === 'desktop' ? 'android' : target.platform)
  const snapshot = useSyncExternalStore(pwaInstaller.subscribe, pwaInstaller.getSnapshot, pwaInstaller.getSnapshot)
  const [statusTitle, statusDescription, statusIcon] = installStatus(snapshot)
  const browsers = GUIDES[platform] || GUIDES.android
  const detectedBrowser = browsers.some(guide => guide.id === target.browser) ? target.browser : 'other'
  const suggestedBrowser = platform === target.platform ? detectedBrowser : DEFAULT_BROWSER[platform]
  const prompting = snapshot.status === 'prompting'
  const osLabel = PLATFORM_LABELS[target.platform] || PLATFORM_LABELS.android

  useEffect(() => { pwaInstaller.start() }, [])

  useEffect(() => () => {
    if (settled.current) return
    update(s => { s.pwaInstallPrompt = snoozePwaInstall() })
  }, [update])

  useEffect(() => {
    if (!snapshot.installed) return
    settled.current = true
    update(s => { s.pwaInstallPrompt = dismissPwaInstallForever() })
    close()
  }, [snapshot.installed, close, update])

  const finishForever = () => {
    settled.current = true
    update(s => { s.pwaInstallPrompt = dismissPwaInstallForever() })
    close()
  }

  const finishLater = () => {
    settled.current = true
    update(s => { s.pwaInstallPrompt = snoozePwaInstall() })
    close()
  }

  return (
    <div className="pwa-install-prompt" role="dialog" aria-labelledby="pwa-install-prompt-title">
      <header className="pwa-install-prompt-head">
        <span className="pwa-install-icon" aria-hidden="true"><Icon name="download" /></span>
        <div>
          <p className="pwa-install-prompt-kicker">Dica rápida</p>
          <h3 id="pwa-install-prompt-title">Instale o Fit Pro Player</h3>
          <p>Use como aplicativo no celular: ícone na tela inicial, abertura rápida e tela cheia.</p>
        </div>
      </header>

      <div className="pwa-install-prompt-os" aria-label="Sistema detectado">
        <Icon name="sparkles" />
        <div>
          <strong>{osLabel}</strong>
          <span>Detectamos este dispositivo. Você pode trocar abaixo se estiver errado.</span>
        </div>
      </div>

      <div className="pwa-install-status" role="status" aria-live="polite" aria-atomic="true" data-installed={snapshot.installed ? 'true' : 'false'}>
        <Icon name={statusIcon} />
        <div><strong>{statusTitle}</strong><p>{statusDescription}</p></div>
      </div>

      {!snapshot.installed && (snapshot.canInstall || prompting) && (
        <Button
          variant="primary"
          icon="download"
          className="pwa-install-button"
          activation="immediate"
          disabled={prompting}
          aria-busy={prompting || undefined}
          onClick={() => { void pwaInstaller.install() }}
        >
          {prompting ? 'Confirme no navegador…' : 'Instalar agora'}
        </Button>
      )}

      <div className="pwa-platform-picker" role="group" aria-label="Tipo de dispositivo">
        <p>Passo a passo para</p>
        <Segmented className="pwa-platform-segmented" options={PLATFORMS} value={platform} onChange={setPlatform} />
      </div>

      <div className="pwa-browser-list pwa-install-prompt-guides">
        {browsers.map(guide => (
          <BrowserGuide key={`${platform}-${guide.id}`} guide={guide} suggested={guide.id === suggestedBrowser} />
        ))}
      </div>

      <div className="pwa-install-prompt-actions">
        <Button variant="plain" className="pwa-install-prompt-later" onClick={finishLater}>
          Agora não
        </Button>
        <button type="button" className="pwa-install-prompt-never" onClick={finishForever}>
          Não mostrar novamente
        </button>
      </div>
    </div>
  )
}

let scheduled = null

export function maybeOpenPwaInstallPrompt({ delayMs = 900 } = {}) {
  if (typeof window === 'undefined') return () => {}
  pwaInstaller.start()
  window.clearTimeout(scheduled)
  scheduled = window.setTimeout(() => {
    scheduled = null
    const S = useStore.getState().S
    const snapshot = pwaInstaller.getSnapshot()
    if (!shouldShowPwaInstallPrompt(S, snapshot)) return
    const ui = useUI.getState()
    if (ui.sheets?.length) return
    ui.openSheet(close => <PwaInstallSheet close={close} />, { className: 'pwa-install-sheet' })
  }, delayMs)
  return () => {
    window.clearTimeout(scheduled)
    scheduled = null
  }
}

export default PwaInstallSheet
