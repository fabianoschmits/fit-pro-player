import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { useStore } from '../../../store/useStore.js'
import { createProfessionalWorkflowRepository } from '../../../lib/professional-workflow.js'
import { getBrowserSupabaseClient } from '../../../lib/supabase-client.js'
import { useProfessionalResource } from './useProfessionalResource.js'

export function useProgramEditorResource(programId, versionId) {
  const auth = useAuth()
  const [authExpired, setAuthExpired] = useState(false)
  const accountId = auth.status === 'initializing' ? null : auth.user?.id
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const scope = useStore.getState().getScopeToken()
  const resource = useProfessionalResource({
    accountId,
    resourceKey: `program-editor:${programId}:${versionId || 'latest'}`,
    load: async isRequestCurrent => {
      const current = () => isRequestCurrent() && useStore.getState().isScopeCurrent(scope) && scope.scope.userId === accountId
      if (!current()) throw new Error('context-changed')
      const program = await repo.program(programId)
      if (!current()) throw new Error('context-changed')
      if (!program || program.professional_user_id !== accountId) return { missing: 'program' }
      const version = versionId ? await repo.version(versionId) : (await repo.versions(programId))[0]
      if (!current()) throw new Error('context-changed')
      if (versionId && (!version || version.program_id !== programId)) return { missing: 'version' }
      return {
        program,
        version,
        initialDraft: {
          title: program.title, description: program.description || '', objective: program.objective || '',
          weeklyPlan: version?.weekly_plan || {}, workoutTitles: version?.workout_titles || {},
        },
      }
    },
  })
  useEffect(() => {
    setAuthExpired(false)
    if (auth.status !== 'initializing') return
    const timer = window.setTimeout(() => setAuthExpired(true), 12000)
    return () => window.clearTimeout(timer)
  }, [auth.status, accountId])
  return {
    ...resource, repo, accountId, authExpired, authInitializing: auth.status === 'initializing',
    isCurrent: () => resource.isCurrent() && useStore.getState().isScopeCurrent(scope) && scope.scope.userId === accountId,
  }
}
