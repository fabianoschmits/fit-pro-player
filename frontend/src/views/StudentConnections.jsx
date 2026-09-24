import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { Button, Section, TextField } from '../components/ui.jsx'
import AppHeader from '../components/AppHeader.jsx'
import { assignedPlanToState } from '../lib/assigned-program.js'
import { useStore } from '../store/useStore.js'

export default function StudentConnections() {
  const auth = useAuth(); const [params] = useSearchParams(); const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const [code, setCode] = useState(params.get('code') || ''); const [preview, setPreview] = useState(null); const [relations, setRelations] = useState([]); const [assignments, setAssignments] = useState([]); const [executions, setExecutions] = useState([]); const [message, setMessage] = useState(''); const [error, setError] = useState('')
  const refresh = () => Promise.all([repo.relationships(auth.user.id), repo.assignments(), repo.executions()]).then(async ([nextRelations, nextAssignments, nextExecutions]) => {
    setRelations(nextRelations); setAssignments(nextAssignments); setExecutions(nextExecutions)
    const latest = nextAssignments.filter(item => item.status === 'active').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
    if (latest) {
      const version = await repo.version(latest.version_id)
      const current = useStore.getState().S
      if (version && current.assignedProgram?.versionId !== version.id) useStore.getState().replaceState(assignedPlanToState({ ...current }, version, latest))
    }
  }).catch(() => setError('Não foi possível carregar seus profissionais.'))
  useEffect(() => { if (auth.user?.id) { refresh(); if (params.get('code')) repo.previewInvite(params.get('code')).then(rows => setPreview(rows?.[0] || null)).catch(() => setError('Convite inválido ou expirado.')) } }, [auth.user?.id])
  const previewInvite = async () => { try { const rows = await repo.previewInvite(code); setPreview(rows?.[0] || null); if (!rows?.length) setError('Convite inválido ou expirado.') } catch { setError('Não foi possível consultar o convite.') } }
  const accept = async () => { try { await repo.acceptInvite(code); setMessage('Vínculo aceito.'); setPreview(null); refresh() } catch { setError('Não foi possível aceitar este convite.') } }
  const start = async assignment => { try { const { error: startError } = await getBrowserSupabaseClient().from('workout_executions').insert({ assignment_id: assignment.id, version_id: assignment.version_id, student_user_id: auth.user.id, day_key: 'monday', payload: {}, status: 'in_progress' }); if (startError) throw startError; setMessage('Treino iniciado.'); refresh() } catch { setError('Não foi possível iniciar o treino.') } }
  return <div className="narrow"><AppHeader title="Meus profissionais" backTo="/more" />{error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}<Section title="Tenho um código do meu profissional"><TextField aria-label="Código do profissional" placeholder="Ex.: A1B2C3D4E5" value={code} onChange={e => setCode(e.target.value.toUpperCase())} /><Button onClick={previewInvite}>Consultar convite</Button>{preview && <div className="card"><strong>{preview.professional_name}</strong><span>{preview.bio || 'Perfil profissional'}</span><span className="muted small">Status: {preview.verification_status}</span><Button onClick={accept}>Aceitar vínculo</Button></div>}</Section><Section title="Vínculos ativos">{relations.filter(r => r.status === 'active').map(r => <div className="card" key={r.id}><span>{r.professional_user_id}</span><Button onClick={() => repo.revokeRelationship(r.id).then(refresh)}>Desvincular</Button></div>)}{!relations.filter(r => r.status === 'active').length && <p className="muted">Você ainda não possui profissionais vinculados.</p>}</Section><Section title="Programas recebidos">{assignments.filter(a => a.status === 'active').map(a => <div className="card" key={a.id}><strong>Versão {a.version_id}</strong><Button onClick={() => start(a)}>Iniciar treino</Button></div>)}{!assignments.length && <p className="muted">Nenhum programa atribuído ainda.</p>}<p className="muted small">Execuções registradas: {executions.length}</p></Section></div>
}
