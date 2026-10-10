import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ManagementPanel } from './ManagementUI.jsx'
import { nextScheduledWorkouts } from '../lib/professional-program.js'
import { professionalDate, statusLabel } from '../lib/professional-ux.js'
import { t } from '../lib/i18n.js'
import { professionalDayLabel, ProfessionalPrescription } from './ProfessionalPrescription.jsx'
import { Button, Section } from './ui.jsx'

export default function StudentProgramOverview({ overview = {}, onStart, managementCompact = false, trainingTo }) {
  const [limit, setLimit] = useState(20)
  const plan = overview.version?.weeklyPlan || {}
  const upcoming = nextScheduledWorkouts(plan, new Date(), 5)
  const executions = overview.executions || []
  if (managementCompact && overview.program) {
    const next = upcoming[0]
    return <div className="student-program-overview">
      <ManagementPanel title={t('Próximo treino')}>{next ? <div className="management-next-workout"><div><strong>{professionalDayLabel(next.day)}</strong><p className="muted">{professionalDate(next.date)} · {t('{0} exercício(s)', next.exercises.length)}</p></div><Button onClick={() => onStart?.(next)}>{t('Iniciar')}</Button></div> : <p className="muted">{t('Nenhum treino programado.')}</p>}</ManagementPanel>
      <ManagementPanel title={t('Programa atual')} action={trainingTo && <Link className="management-button" to={trainingTo}>{t('Ver treino recebido')}</Link>}><h3>{overview.program.title}</h3><p className="muted">{t('{0} · versão {1}', overview.professional?.name || t('Profissional'), overview.version?.versionNumber || '—')}</p>{overview.version?.publishedAt && <p className="muted">{t('Atualizado em {0}', professionalDate(overview.version.publishedAt))}</p>}{overview.program.description && <p>{overview.program.description}</p>}</ManagementPanel>
    </div>
  }
  if (!overview.program) return <Section title={t('Programa profissional')}><p className="muted">{t('Você ainda não recebeu um programa ativo.')}</p></Section>
  return <div className="student-program-overview">
    <Section title={t('Programa atual')}><h3>{overview.program.title}</h3><p className="muted">{t('{0} · versão {1}', overview.professional?.name || t('Profissional'), overview.version?.versionNumber || '—')}</p>{overview.version?.publishedAt && <p className="muted">{t('Atualizado em {0}', professionalDate(overview.version.publishedAt))}</p>}{overview.program.description && <p>{overview.program.description}</p>}<details><summary>{t('Ver prescrição completa')}</summary><ProfessionalPrescription plan={plan} /></details></Section>
    <Section title={t('Próximos treinos')}>{upcoming.length ? upcoming.map(item => <div className="card row between" key={item.date}><span><strong>{professionalDayLabel(item.day)}</strong><small className="muted">{professionalDate(item.date)} · {t('{0} exercício(s)', item.exercises.length)}</small></span><Button onClick={() => onStart?.(item)}>{t('Iniciar')}</Button></div>) : <p className="muted">{t('Nenhum treino programado.')}</p>}</Section>
    <Section title={t('Histórico')}>{executions.length ? executions.slice(0, limit).map(item => <div className="card" key={item.id}><strong>{professionalDayLabel(item.day_key)}</strong><span className="muted">{statusLabel(item.status)} · {professionalDate(item.started_at, true)}</span></div>) : <p className="muted">{t('Nenhuma execução registrada.')}</p>}{executions.length > limit && <Button onClick={() => setLimit(value => value + 20)}>{t('Carregar mais')}</Button>}</Section>
  </div>
}
