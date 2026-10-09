import { useProfessionalSession } from './useProfessionalSession.js'
import { useProfessionalResource } from './useProfessionalResource.js'
export function useProgramVersionsResource(programId, selectedIds = []) {
  const session = useProfessionalSession()
  const resource = useProfessionalResource({ accountId: session.accountId, resourceKey: `program-versions:${programId}:${selectedIds.join(':')}`,
    load: async requestCurrent => {
      const current = () => requestCurrent() && session.isScopeCurrent()
      if (!current()) throw new Error('context-changed')
      const program = await session.repo.program(programId)
      if (!current()) throw new Error('context-changed')
      if (!program || program.professional_user_id !== session.accountId) return { missing: 'program' }
      const versions = [...await session.repo.versions(programId)]
      if (!current()) throw new Error('context-changed')
      for (const id of selectedIds.filter(Boolean)) {
        if (versions.some(version => version.id === id)) continue
        const version = await session.repo.version(id)
        if (!current()) throw new Error('context-changed')
        if (!version || version.program_id !== programId) return { missing: 'version' }
        versions.push(version)
      }
      return { program, versions }
    },
  })
  return { ...session, ...resource, isCurrent: () => resource.isCurrent() && session.isScopeCurrent() }
}
