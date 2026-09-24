import { nextScheduledWorkouts } from '../lib/professional-program.js'
import { Button, Section } from './ui.jsx'

const dayLabels = { sunday: 'Domingo', monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta', thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado' }

export default function StudentProgramOverview({ overview = {}, onStart }) {
  const plan = overview.version?.weeklyPlan || {}
  const upcoming = nextScheduledWorkouts(plan, new Date(), 5)
  const executions = overview.executions || []
  if (!overview.program) return <Section title="Programa profissional"><p className="muted">Você ainda não recebeu um programa ativo.</p></Section>
  return <div className="student-program-overview">
    <Section title="Programa atual"><h3>{overview.program.title}</h3><p className="muted">{overview.professional?.name || 'Profissional'} · versão {overview.version?.versionNumber || '—'}</p>{overview.program.description && <p>{overview.program.description}</p>}</Section>
    <Section title="Próximos treinos">{upcoming.length ? upcoming.map(item => <div className="card row between" key={item.date}><span><strong>{dayLabels[item.day]}</strong><small className="muted">{item.date} · {item.exercises.length} exercício(s)</small></span><Button onClick={() => onStart?.(item)}>Iniciar</Button></div>) : <p className="muted">Nenhum treino programado.</p>}</Section>
    <Section title="Histórico">{executions.length ? executions.map(item => <div className="card" key={item.id}><strong>{dayLabels[item.day_key] || item.day_key}</strong><span className="muted small">{item.status} · {item.started_at || 'sem data'}</span></div>) : <p className="muted">Nenhuma execução registrada.</p>}</Section>
  </div>
}
