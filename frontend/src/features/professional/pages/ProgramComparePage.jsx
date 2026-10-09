import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import { ProfessionalPrescription } from '../../../components/ProfessionalPrescription.jsx'
import { useProgramVersionsResource } from '../hooks/useProgramVersionsResource.js'
import { WEEK_DAYS, DAY_LABELS } from '../hooks/useProgramDraft.js'
import { professionalPath, preserveProfessionalIdentity } from '../routes.js'
import ProfessionalLayout from '../components/ProfessionalLayout.jsx'
import ProgramResourceGate from '../components/ProgramResourceGate.jsx'
import ResourceNotice from '../components/ResourceNotice.jsx'
import EmptyState from '../components/EmptyState.jsx'
export default function ProgramComparePage() {
  const { programId } = useParams(), location = useLocation(), [params, setParams] = useSearchParams()
  const beforeId = params.get('before'), afterId = params.get('after')
  const resource = useProgramVersionsResource(programId, [beforeId, afterId])
  const to = (kind, extra = {}) => preserveProfessionalIdentity(professionalPath({ kind, id: programId, ...extra }), location.search)
  const versions = resource.data?.versions || []
  const before = beforeId ? versions.find(version => version.id === beforeId) : versions[1] || versions[0]
  const after = afterId ? versions.find(version => version.id === afterId) : versions[0]
  const choose = (key, value) => { const next = new URLSearchParams(params); next.set(key, value); setParams(next, { replace: true, state: location.state }) }
  return <ProgramResourceGate resource={resource}>{resource.data?.program && <ProfessionalLayout title={t('Comparar versões')} subtitle={resource.data.program.title} backTo={to('programVersions')}>
    <ResourceNotice resource={resource} />
    {before && after ? <div className="professional-program-comparison">{[['before', before, 'Versão anterior'], ['after', after, 'Versão nova']].map(([side, version, label]) => <section key={side}>
      <label>{t(label)}<select aria-label={t(label)} value={version.id} onChange={event => choose(side, event.target.value)}>{versions.map(item => <option key={item.id} value={item.id}>{t('Versão {0}', item.version_number)}</option>)}</select></label>
      <h2>{t('Versão {0}', version.version_number)}</h2>
      {WEEK_DAYS.map(day => <section key={day}><h3>{t(DAY_LABELS[day])}{version.workout_titles?.[day] ? ` · ${version.workout_titles[day]}` : ''}</h3>
        {version.weekly_plan?.[day]?.length ? <ProfessionalPrescription entries={version.weekly_plan[day]} /> : <p className="muted">{t('Rest')}</p>}
      </section>)}
      {!resource.data.program.archived && <Link className="management-button" to={preserveProfessionalIdentity(`${professionalPath({ kind: 'programEdit', id: programId })}?version=${encodeURIComponent(version.id)}`, location.search)} state={location.state}>{t('Criar nova versão')}</Link>}
    </section>)}</div> : <EmptyState title={t('Sem versão publicada')} />}
  </ProfessionalLayout>}</ProgramResourceGate>
}
