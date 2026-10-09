import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { professionalPath, preserveProfessionalIdentity } from '../features/professional/routes.js'
import ProgramLibraryPage from '../features/professional/pages/ProgramLibraryPage.jsx'
import ProgramNewPage from '../features/professional/pages/ProgramNewPage.jsx'
import ProgramPublishedPage from '../features/professional/pages/ProgramPublishedPage.jsx'
export default function ProfessionalPrograms() {
  const { programId } = useParams(), location = useLocation()
  const { user } = useAuth()
  if (programId) return <ProgramPublishedPage />
  const params = new URLSearchParams(location.search)
  if (!location.pathname.endsWith('/new') && params.get('program')) {
    const id = params.get('program'), versionId = params.get('version')
    const returnParams = new URLSearchParams(location.search)
    returnParams.delete('program')
    returnParams.delete('version')
    const programsReturn = `/professional/programs${returnParams.size ? `?${returnParams}` : ''}`
    const state = { ...location.state, programsReturn, programsAccount: user?.id || null }
    return <Navigate replace to={preserveProfessionalIdentity(professionalPath({ kind: versionId ? 'programVersion' : 'program', id, versionId }), location.search)} state={state} />
  }
  return location.pathname.endsWith('/new') ? <ProgramNewPage /> : <ProgramLibraryPage />
}
