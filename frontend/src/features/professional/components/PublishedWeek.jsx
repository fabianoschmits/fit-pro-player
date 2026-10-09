import { t } from '../../../lib/i18n.js'
import { WEEK_DAYS } from '../hooks/useProgramDraft.js'
import { professionalPath, preserveProfessionalIdentity } from '../routes.js'
import CompactList from './CompactList.jsx'
import WorkoutRow from './WorkoutRow.jsx'
import SectionHeader from './SectionHeader.jsx'
export default function PublishedWeek({ programId, version, search = '', state }) {
  return <section className="professional-published-week">
    <SectionHeader title={t('Semana publicada')} />
    <CompactList>{WEEK_DAYS.map(day => <WorkoutRow key={day} day={day} title={version?.workout_titles?.[day]} count={version?.weekly_plan?.[day]?.length || 0}
      to={preserveProfessionalIdentity(professionalPath({ kind: 'programWorkout', id: programId, day }), search)} state={state} />)}</CompactList>
    {!version && <p className="muted">{t('Sem versão publicada')}</p>}
  </section>
}
