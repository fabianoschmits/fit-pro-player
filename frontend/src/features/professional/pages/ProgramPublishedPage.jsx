import { Link, useLocation, useParams } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import { useProgramEditorResource } from '../hooks/useProgramEditorResource.js'
import { professionalPath, preserveProfessionalIdentity } from '../routes.js'
import ProfessionalLayout from '../components/ProfessionalLayout.jsx'
import ProgramResourceGate from '../components/ProgramResourceGate.jsx'
import ResourceNotice from '../components/ResourceNotice.jsx'
import ProgramActions from '../components/ProgramActions.jsx'
import PublishedWeek from '../components/PublishedWeek.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import BottomActionBar from '../components/BottomActionBar.jsx'

export default function ProgramPublishedPage() {
  const { programId, versionId } = useParams(), location = useLocation()
  const exactVersion = versionId || new URLSearchParams(location.search).get('version')
  const resource = useProgramEditorResource(programId, exactVersion)
  return <ProgramResourceGate resource={resource}>{resource.data?.program && <Published key={`${resource.accountId}:${programId}:${exactVersion || 'latest'}`} resource={resource} exact={!!versionId} />}</ProgramResourceGate>
}
function Published({ resource, exact }) {
  const location = useLocation(), { program, version } = resource.data
  const params = new URLSearchParams(location.search)
  // A version route carries its identity into every week/day/editor/assignment handoff.
  if (exact && version) params.set('version', version.id)
  const search = exact ? `?${params}` : location.search
  const to = (kind, extra = {}) => preserveProfessionalIdentity(professionalPath({ kind, id: program.id, ...extra }), search)
  const backTo = exact ? to('programVersions') : location.state?.programsAccount === resource.accountId && location.state?.programsReturn || preserveProfessionalIdentity('/professional/programs', location.search)
  return <ProfessionalLayout title={program.title} subtitle={version ? t('Versão {0}', version.version_number) : t('Sem versão publicada')} backTo={backTo}
    action={<ProgramActions resource={resource} />}>
    <ResourceNotice resource={resource} />
    <StatusBadge status={program.archived ? 'archived' : 'active'} />
    {program.objective && <p className="professional-program-objective">{program.objective}</p>}
    {program.description && <p className="muted professional-program-description">{program.description}</p>}
    <PublishedWeek programId={program.id} version={version} search={search} state={location.state} />
    <Link to={to('programVersions')} state={location.state}>{t('Versões publicadas')}</Link>
    {!program.archived && <BottomActionBar><Link className="management-button" to={to('programEdit')} state={location.state}>{t(version ? 'Criar nova versão' : 'Editar programa')}</Link>
      {version && <Link className="management-button management-button-primary" to={to('programAssign', { versionId: version.id })} state={location.state}>{t('Enviar para aluno')}</Link>}
    </BottomActionBar>}
  </ProfessionalLayout>
}
