import { Link, useLocation, useParams } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import { professionalDate } from '../../../lib/professional-ux.js'
import { useProgramVersionsResource } from '../hooks/useProgramVersionsResource.js'
import { professionalPath, preserveProfessionalIdentity } from '../routes.js'
import ProfessionalLayout from '../components/ProfessionalLayout.jsx'
import ProgramResourceGate from '../components/ProgramResourceGate.jsx'
import ResourceNotice from '../components/ResourceNotice.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import CompactList from '../components/CompactList.jsx'
import EmptyState from '../components/EmptyState.jsx'
export default function ProgramVersionsPage() {
  const { programId } = useParams(), location = useLocation()
  const resource = useProgramVersionsResource(programId)
  const to = kind => preserveProfessionalIdentity(professionalPath({ kind, id: programId }), location.search)
  return <ProgramResourceGate resource={resource}>{resource.data?.program && <ProfessionalLayout title={resource.data.program.title} subtitle={t('Versões publicadas')} backTo={to('program')}>
    <ResourceNotice resource={resource} />
    <SectionHeader title={t('Versões publicadas')} action={resource.data.versions.length > 1 && <Link to={to('programCompare')} state={location.state}>{t('Comparar versões')}</Link>} />
    <CompactList empty={<EmptyState title={t('Sem versão publicada')} />}>{resource.data.versions.map(version => <li className="professional-row" key={version.id}>
      <Link className="professional-row-link" state={location.state} to={preserveProfessionalIdentity(professionalPath({ kind: 'programVersion', id: programId, versionId: version.id }), location.search)}>
        <span className="professional-row-copy"><strong>{t('Versão {0}', version.version_number)}</strong><small>{professionalDate(version.published_at)}</small><small>{t('{0} treinos', Object.values(version.weekly_plan || {}).filter(entries => entries.length).length)}</small></span><span aria-hidden="true">›</span>
      </Link>
    </li>)}</CompactList>
  </ProfessionalLayout>}</ProgramResourceGate>
}
