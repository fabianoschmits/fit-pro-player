import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { createProfessionalExecutionRepository } from '../lib/professional-execution.js'
import { withTimeout } from '../lib/professional-ux.js'
import { assignedPlanToState } from '../lib/assigned-program.js'
import { useStore } from '../store/useStore.js'
import { startFlow } from '../sheets.jsx'
import { Button, Section, TextField } from '../components/ui.jsx'
import AppHeader from '../components/AppHeader.jsx'
import StudentProgramOverview from '../components/StudentProgramOverview.jsx'

export default function StudentProfessionals() {
  const auth = useAuth(); const [params] = useSearchParams(); const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const [code, setCode] = useState(params.get('code') || ''); const [preview, setPreview] = useState(null); const [relations, setRelations] = useState([]); const [assignments, setAssignments] = useState([]); const [overview, setOverview] = useState({}); const [busy, setBusy] = useState(true); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [confirmRelationshipId, setConfirmRelationshipId] = useState('')
  const refresh = () => { setBusy(true); setError(''); return withTimeout(Promise.all([repo.relationships(auth.user.id), repo.assignments(), repo.studentOverview()]), 10000).then(async ([nextRelations, nextAssignments, nextOverview]) => { setRelations(nextRelations); setAssignments(nextAssignments); setOverview(nextOverview || {}); const latest = nextAssignments.filter(item => item.status === 'active').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]; if (latest) { const version = await withTimeout(repo.version(latest.version_id), 10000); const current = useStore.getState().S; if (version && current.assignedProgram?.versionId !== version.id) useStore.getState().replaceState(assignedPlanToState({ ...current }, version, latest)) } }).catch(cause => setError(cause?.message === 'request-timeout' ? 'A conexão demorou mais que o esperado.' : 'Não foi possível carregar seus profissionais.')).finally(() => setBusy(false)) }
  useEffect(() => {
    if (auth.status === 'initializing') {
      const guard = window.setTimeout(() => {
        setBusy(false)
        setError('Não foi possível confirmar sua sessão. Tente novamente.')
      }, 12000)
      return () => window.clearTimeout(guard)
    }
    if (!auth.user?.id) {
      setBusy(false)
      setError('Entre na sua conta para acessar seus profissionais.')
      return
    }
    let settled = false
    const request = refresh()
    const guard = window.setTimeout(() => {
      if (!settled) {
        setBusy(false)
        setError('A conexão demorou mais que o esperado.')
      }
    }, 12000)
    Promise.resolve(request).finally(() => { settled = true; window.clearTimeout(guard) })
    if (params.get('code')) repo.previewInvite(params.get('code')).then(rows => setPreview(rows?.[0] || null)).catch(() => setError('Convite inválido ou expirado.'))
    return () => { settled = true; window.clearTimeout(guard) }
  }, [auth.status, auth.user?.id])
  const previewInvite = async () => { setError(''); try { const rows = await repo.previewInvite(code); setPreview(rows?.[0] || null); if (!rows?.length) setError('Convite inválido ou expirado.') } catch { setError('Não foi possível consultar o convite.') } }
  const accept = async () => { try { await repo.acceptInvite(code); setMessage('Vínculo aceito.'); setPreview(null); await refresh() } catch { setError('Não foi possível aceitar este convite.') } }
  const start = async item => { const assignment = assignments.find(entry => entry.status === 'active'); if (!assignment) return; try { const execution = await createProfessionalExecutionRepository({ client: getBrowserSupabaseClient() }).startAssignedExecution({ assignmentId: assignment.id, versionId: assignment.version_id, studentUserId: auth.user.id, dayKey: item.day }); const dayNumber = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }[item.day]; startFlow(useStore.getState().S.week?.[dayNumber] || null, execution.id); setMessage('Treino iniciado.'); await refresh() } catch { setError('Não foi possível iniciar o treino.') } }
  const activeRelations = relations.filter(item => item.status === 'active')
  return <div className="narrow student-professionals-page"><AppHeader title="Meus profissionais" subtitle="Vínculos, convites e treinos recebidos" backTo="/more" />{error && <p role="alert" className="error">{error} <button className="link" onClick={refresh}>Tentar novamente</button></p>}{message && <p role="status">{message}</p>}{busy ? <p role="status">Carregando…</p> : <>
    <Section title="Adicionar profissional"><p className="muted">Digite o código recebido e confira o perfil antes de vincular.</p><TextField aria-label="Código do profissional" placeholder="Ex.: A1B2C3D4E5" value={code} onChange={event => setCode(event.target.value.toUpperCase())} /><Button onClick={previewInvite}>Continuar</Button>{preview && <div className="card invite-preview-card"><strong>{preview.professional_name}</strong><span>{preview.bio || 'Perfil profissional'}</span>{preview.specialties?.length > 0 && <span className="muted small">{preview.specialties.join(' · ')}</span>}<Button variant="primary" onClick={accept}>Vincular a este profissional</Button></div>}</Section>
    <Section title={`Profissionais vinculados (${activeRelations.length})`}>{activeRelations.length ? activeRelations.map(item => <div className="card row between" key={item.id}><span><strong>Profissional vinculado</strong><small className="muted">Desde {String(item.accepted_at || item.created_at || '').slice(0, 10) || '—'}</small></span>{confirmRelationshipId === item.id ? <span className="danger-confirm"><strong>Desvincular este profissional?</strong><Button variant="danger" onClick={() => repo.revokeRelationship(item.id).then(() => { setConfirmRelationshipId(''); return refresh() })}>Confirmar</Button><Button onClick={() => setConfirmRelationshipId('')}>Cancelar</Button></span> : <Button variant="ghost" onClick={() => setConfirmRelationshipId(item.id)}>Desvincular</Button>}</div>) : <p className="muted">Você ainda não possui profissionais vinculados.</p>}</Section>
    <StudentProgramOverview overview={overview} onStart={start} />
  </>}</div>
}
