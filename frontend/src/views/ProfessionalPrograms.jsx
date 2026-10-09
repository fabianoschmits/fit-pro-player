import { Navigate, useLocation, useParams } from 'react-router-dom'
import { professionalPath, preserveProfessionalIdentity } from '../features/professional/routes.js'
import ProgramLibraryPage from '../features/professional/pages/ProgramLibraryPage.jsx'
import ProgramNewPage from '../features/professional/pages/ProgramNewPage.jsx'
import ProgramPublishedPage from '../features/professional/pages/ProgramPublishedPage.jsx'
export default function ProfessionalPrograms() {
  const { programId } = useParams(), location = useLocation()
  if (programId) return <ProgramPublishedPage />
  const params = new URLSearchParams(location.search)
  if (!location.pathname.endsWith('/new') && params.get('program')) {
    const id = params.get('program'), versionId = params.get('version')
    return <Navigate replace to={preserveProfessionalIdentity(professionalPath({ kind: versionId ? 'programVersion' : 'program', id, versionId }), location.search)} state={location.state} />
  }
  return location.pathname.endsWith('/new') ? <ProgramNewPage /> : <ProgramLibraryPage />
}
