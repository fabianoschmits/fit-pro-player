import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { prepareOfflinePlan } from '../lib/offline-plan.js'
import { MOBILE } from '../lib/mobile.js'
import { Button } from './ui.jsx'
import { t } from '../lib/i18n.js'
import { FppActionFeedback, FppProgress } from './FppFeedback.jsx'

export default function OfflineControls() {
  const state = useStore(s => s.S), [result, setResult] = useState(null), [busy, setBusy] = useState(false), [progress, setProgress] = useState({ done: 0, total: 0 })
  if (MOBILE) return <p className="muted small">{t('Your plan and exercise media are available on this device.')}</p>
  const prepare = async () => {
    setBusy(true); setResult(null)
    setProgress({ done: 0, total: 0 })
    try {
      const next = await prepareOfflinePlan(state, { onProgress: setProgress })
      setResult(next)
      if (!next.ready) throw new Error('offline-incomplete')
    }
    catch (error) { setResult({ ready: false }); throw error }
    finally { setBusy(false) }
  }
  return <div className="offline-controls" data-ready={result?.ready ? 'true' : 'false'}>
    <Button variant="tinted" onAction={prepare} loadingLabel={t('Preparing offline plan…')} successLabel={t('Done')}>{t('Download plan for offline use')}</Button>
    {busy && <FppProgress label={t('Preparing offline plan…')} value={progress.total ? progress.done : undefined} max={progress.total || 1} />}
    <FppActionFeedback state={result ? result.ready ? 'success' : 'error' : 'idle'} className="muted small">{result ? result.ready ? t('Plan media ready offline. Account and professional updates require a connection.') : t('Offline preparation incomplete. Connect and try again.') : t('Download exercise media before training without a connection.')}</FppActionFeedback>
  </div>
}
