import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { useStore } from '../../../store/useStore.js'
import { getBrowserSupabaseClient } from '../../../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../../../lib/professional-workflow.js'
export function useProfessionalSession() {
  const auth = useAuth()
  const accountId = auth.status === 'initializing' ? null : auth.user?.id
  const [authExpired, setAuthExpired] = useState(false)
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const scope = useStore.getState().getScopeToken()
  useEffect(() => {
    setAuthExpired(false)
    if (auth.status !== 'initializing') return
    const timer = window.setTimeout(() => setAuthExpired(true), 12000)
    return () => window.clearTimeout(timer)
  }, [auth.status, accountId])
  return { repo, accountId, authExpired, authInitializing: auth.status === 'initializing', scope,
    isScopeCurrent: () => !!accountId && useStore.getState().isScopeCurrent(scope) && scope.scope.userId === accountId }
}
