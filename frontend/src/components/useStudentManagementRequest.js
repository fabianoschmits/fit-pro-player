import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { withTimeout } from '../lib/professional-ux.js'
import { t } from '../lib/i18n.js'

// Each workspace is keyed by account/person. Request generations also protect retries.
export default function useStudentManagementRequest(load, failure) {
  const auth = useAuth()
  const alive = useRef(false); const generation = useRef(0)
  const [data, setData] = useState(null); const [busy, setBusy] = useState(true); const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    if (!auth.user?.id || auth.status === 'initializing' || !alive.current) return
    const request = ++generation.current
    const current = () => alive.current && generation.current === request
    setBusy(true); setError(''); setData(null)
    try { const value = await withTimeout(load(current), 10000); if (current()) setData(value) }
    catch (cause) { if (current()) { generation.current++; setError(t(cause?.message === 'request-timeout' ? 'A conexão demorou mais que o esperado.' : failure)); setBusy(false) } }
    finally { if (current()) setBusy(false) }
  }, [auth.user?.id, auth.status, load, failure])
  useEffect(() => {
    alive.current = true
    let timer
    if (auth.status === 'initializing') timer = window.setTimeout(() => { setBusy(false); setError(t('Não foi possível confirmar sua sessão. Tente novamente.')) }, 12000)
    else if (!auth.user?.id) { setBusy(false); setError(t('Entre na sua conta para acessar seus profissionais.')) }
    else void refresh()
    return () => { alive.current = false; generation.current++; window.clearTimeout(timer) }
  }, [auth.status, auth.user?.id, refresh])
  return { data, busy, error, refresh }
}
