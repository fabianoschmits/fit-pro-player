import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { prepareOfflinePlan } from '../lib/offline-plan.js'
import { MOBILE } from '../lib/mobile.js'
import { Button } from './ui.jsx'
import { t } from '../lib/i18n.js'

export default function OfflineControls() {
  const state = useStore(s => s.S), [result, setResult] = useState(null), [busy, setBusy] = useState(false), [progress, setProgress] = useState({ done: 0, total: 0 })
  if (MOBILE) return <p className="muted small">{t('Your plan and exercise media are available on this device.')}</p>
  const prepare = async () => {
    setBusy(true); setResult(null)
    try { setResult(await prepareOfflinePlan(state, { onProgress: setProgress })) }
    catch { setResult({ ready: false }) }
    finally { setBusy(false) }
  }
  return <div className="offline-controls" data-ready={result?.ready ? 'true' : 'false'}>
    <Button variant="tinted" disabled={busy} onClick={prepare}>{busy ? t('Preparing offline plan…') : t('Download plan for offline use')}</Button>
    {busy && <progress aria-label={t('Preparing offline plan…')} value={progress.done} max={progress.total || 1} />}
    <p className="muted small" role="status">{result ? result.ready ? t('Plan media ready offline. Account and professional updates require a connection.') : t('Offline preparation incomplete. Connect and try again.') : t('Download exercise media before training without a connection.')}</p>
  </div>
}
