import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../../lib/supabase-client.js'
import { createConsoleRepository } from '../../lib/console.js'
import ConsoleShell from './ConsoleLayout.jsx'
import { Empty, Loading } from './ConsoleUI.jsx'

export function useConsoleAccess() {
  const auth = useAuth()
  const userId = auth.status === 'authenticated' ? auth.user?.id : null
  const repo = useMemo(() => createConsoleRepository({ client: getBrowserSupabaseClient() }), [])
  const [access, setAccess] = useState({ userId: null, allowed: null })
  useEffect(() => {
    let live = true
    if (!userId) { setAccess({ userId, allowed: false }); return }
    repo.adminRole(userId).then(allowed => { if (live) setAccess({ userId, allowed }) }).catch(() => { if (live) setAccess({ userId, allowed: false }) })
    return () => { live = false }
  }, [userId, repo])
  return { userId, repo, allowed: !userId ? false : access.userId === userId ? access.allowed : null }
}

export function AccessGate({ allowed, children }) {
  if (allowed === null) return <ConsoleShell><div className="cx-page-body"><Loading label="Verificando acesso…" /></div></ConsoleShell>
  if (!allowed) return <ConsoleShell><div className="cx-page-body"><Empty title="Sem acesso" sub="Esta área está disponível apenas para a equipe autorizada." /></div></ConsoleShell>
  return children
}
