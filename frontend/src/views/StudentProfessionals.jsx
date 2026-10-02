import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { t } from '../lib/i18n.js'
import { withTimeout, professionalDate } from '../lib/professional-ux.js'
import { assignedPlanToState, clearAssignedProgramFromState } from '../lib/assigned-program.js'
import { useStore } from '../store/useStore.js'
import { startFlow } from '../sheets.jsx'
import { Button, Section, TextField } from '../components/ui.jsx'
import AppHeader from '../components/AppHeader.jsx'
import StudentProgramOverview from '../components/StudentProgramOverview.jsx'
export default function StudentProfessionals() {
  const auth = useAuth(); const [params] = useSearchParams(); const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const owner = useRef(auth.user?.id); owner.current = auth.user?.id
  const [code, setCode] = useState(params.get('code') || ''); const [preview, setPreview] = useState(null); const [relations, setRelations] = useState([]); const [assignments, setAssignments] = useState([]); const [overview, setOverview] = useState({}); const [busy, setBusy] = useState(true); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [confirmRelationshipId, setConfirmRelationshipId] = useState('')
  const refresh = async () => {
    const id = auth.user?.id; setBusy(true); setError('')
    try {
      const [nextRelations, nextAssignments, nextOverview] = await withTimeout(Promise.all([repo.relationships(id), repo.assignments(), repo.studentOverview()]), 10000)
      if (owner.current !== id) return
      const latest = nextAssignments.filter(item => item.status === 'active').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
      const version = latest ? await withTimeout(repo.version(latest.version_id), 10000) : null
      if (owner.current !== id) return
      setRelations(nextRelations); setAssignments(nextAssignments); setOverview(nextOverview || {})
      const current = useStore.getState().S
      if (version && (current.assignedProgram?.versionId !== version.id || current.assignedProgram?.assignmentId !== latest.id)) useStore.getState().replaceState(assignedPlanToState({ ...current }, version, latest))
      else if (!latest && current.assignedProgram) useStore.getState().replaceState(clearAssignedProgramFromState({ ...current }))
    } catch (cause) { if (owner.current === id) setError(t(cause?.message === 'request-timeout' ? 'A conexão demorou mais que o esperado.' : 'Não foi possível carregar seus profissionais.')) }
    finally { if (owner.current === id) setBusy(false) }
  }
  useEffect(() => {
    owner.current = auth.user?.id
    if (auth.status === 'initializing') {
      const guard = window.setTimeout(() => {
        setBusy(false)
        setError(t('Não foi possível confirmar sua sessão. Tente novamente.'))
      }, 12000)
      return () => window.clearTimeout(guard)
    }
    if (!auth.user?.id) {
      setBusy(false)
      setError(t('Entre na sua conta para acessar seus profissionais.'))
      return
    }
    let settled = false
    const request = refresh()
    const guard = window.setTimeout(() => {
      if (!settled) {
        setBusy(false)
        setError(t('A conexão demorou mais que o esperado.'))
      }
    }, 12000)
    Promise.resolve(request).finally(() => { settled = true; window.clearTimeout(guard) })
    if (params.get('code')) repo.previewInvite(params.get('code')).then(rows => { if (owner.current === auth.user?.id) setPreview(rows?.[0] || null) }).catch(() => setError(t('Convite inválido ou expirado.')))
    return () => { settled = true; owner.current = null; window.clearTimeout(guard) }
  }, [auth.status, auth.user?.id])
  const previewInvite = async () => { setError(''); try { const rows = await repo.previewInvite(code); setPreview(rows?.[0] || null); if (!rows?.length) setError(t('Convite inválido ou expirado.')) } catch { setError(t('Não foi possível consultar o convite.')) } }
  const accept = async () => { try { await repo.acceptInvite(code); setMessage(t('Vínculo aceito.')); setPreview(null); await refresh() } catch { setError(t('Não foi possível aceitar este convite.')) } }
  const start = item => { if (!assignments.some(entry => entry.status === 'active')) return; const dayNumber = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }[item.day]; const routineId = useStore.getState().S.week?.[dayNumber]; if (!routineId) { setError(t('Não foi possível iniciar o treino.')); return } startFlow(routineId) }
  const activeRelations = relations.filter(item => item.status === 'active')
  return <div className="narrow student-professionals-page"><AppHeader title={t("Meus profissionais")} subtitle={t("Vínculos, convites e treinos recebidos")} backTo="/more" />{error && <p role="alert" className="error">{error} <button className="link" onClick={refresh}>{t("Tentar novamente")}</button></p>}{message && <p role="status">{message}</p>}{busy ? <p role="status">{t("Carregando…")}</p> : <>
    <Section title={t("Adicionar profissional")}><p className="muted">{t("Digite o código recebido e confira o perfil antes de vincular.")}</p><TextField aria-label={t("Código do profissional")} placeholder={t("Ex.: A1B2C3D4E5")} value={code} onChange={event => setCode(event.target.value.toUpperCase())} /><Button onClick={previewInvite}>{t("Continuar")}</Button>{preview && <div className="card invite-preview-card"><strong>{preview.professional_name}</strong><span>{preview.bio || t('Perfil profissional')}</span>{preview.specialties?.length > 0 && <span className="muted small">{preview.specialties.join(' · ')}</span>}<Button variant="primary" onClick={accept}>{t("Vincular a este profissional")}</Button></div>}</Section>
    <Section title={t('Profissionais vinculados ({0})', activeRelations.length)}>{activeRelations.length ? activeRelations.map(item => <div className="card row between" key={item.id}><span><strong>{t("Profissional vinculado")}</strong><small className="muted">{t('Desde {0}', professionalDate(item.accepted_at || item.created_at))}</small></span>{confirmRelationshipId === item.id ? <span className="danger-confirm"><strong>{t("Desvincular este profissional?")}</strong><Button variant="danger" onClick={() => repo.revokeRelationship(item.id).then(() => { setConfirmRelationshipId(''); return refresh() }).catch(() => setError(t('Não foi possível encerrar o vínculo.')))}>{t("Confirmar")}</Button><Button onClick={() => setConfirmRelationshipId('')}>{t("Cancelar")}</Button></span> : <Button variant="ghost" onClick={() => setConfirmRelationshipId(item.id)}>{t("Desvincular")}</Button>}</div>) : <p className="muted">{t("Você ainda não possui profissionais vinculados.")}</p>}</Section>
    <StudentProgramOverview overview={overview} onStart={start} />
  </>}</div>
}
