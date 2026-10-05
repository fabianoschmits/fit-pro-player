import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { normalizeInviteCode, withTimeout } from '../lib/professional-ux.js'
import { t } from '../lib/i18n.js'
import { Button, TextField } from './ui.jsx'
import ManagementLayout from './ManagementLayout.jsx'
import { ManagementPanel, ManagementAvatar } from './ManagementUI.jsx'
import useStudentManagementRequest from './useStudentManagementRequest.js'
import { studentVerificationLabel } from './StudentProfessionalVerification.jsx'

export default function StudentProfessionalInvite({ inviteCode }) {
  const auth = useAuth(); const [params] = useSearchParams()
  const initialCode = normalizeInviteCode(inviteCode ?? params.get('code'))
  return <InviteWorkspace key={`${auth.status}:${auth.user?.id}:${initialCode}`} initialCode={initialCode} />
}

function InviteWorkspace({ initialCode }) {
  const auth = useAuth(); const navigate = useNavigate()
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const alive = useRef(false); const acceptancePending = useRef(false)
  const [code, setCode] = useState(initialCode); const [submitted, setSubmitted] = useState({ code: initialCode, revision: 0 })
  const [accepting, setAccepting] = useState(false); const [actionError, setActionError] = useState('')
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const load = useCallback(async () => {
    if (!submitted.code) return null
    const rows = await repo.previewInvite(submitted.code)
    return { code: submitted.code, preview: rows?.[0] || null }
  }, [repo, submitted])
  const { data, busy, error, refresh } = useStudentManagementRequest(load, 'Não foi possível consultar o convite.')
  const preview = data?.code === code ? data.preview : null
  const previewInvite = event => {
    event.preventDefault(); setActionError('')
    const value = normalizeInviteCode(code)
    if (!value) { setActionError(t('Informe o código do convite.')); return }
    setCode(value); setSubmitted(previous => ({ code: value, revision: previous.revision + 1 }))
  }
  const accept = async () => {
    if (!preview || acceptancePending.current || !auth.user?.id || data.code !== code) return
    acceptancePending.current = true
    setAccepting(true); setActionError('')
    try {
      await withTimeout(repo.acceptInvite(data.code), 10000)
      if (!alive.current) return
      sessionStorage.removeItem('fpp-pending-invite')
      navigate('/student/professionals?invite=accepted', { replace: true })
    } catch { if (alive.current) setActionError(t('Não foi possível aceitar este convite. Ele pode ter expirado ou já ter sido utilizado.')) }
    finally { acceptancePending.current = false; if (alive.current) setAccepting(false) }
  }
  return <ManagementLayout audience="student" className="student-invite-page" title={t('Adicionar profissional')} subtitle={t('Confira o perfil antes de aceitar o convite')} backTo="/student/professionals">
    {(error || actionError) && <p role="alert" className="management-error">{error || actionError}{error && auth.user?.id && <Button disabled={accepting} onClick={refresh}>{t('Tentar novamente')}</Button>}</p>}
    <ManagementPanel title={t('Código do convite')} description={t('Digite o código recebido e confira o perfil antes de vincular.')}>
      <form onSubmit={previewInvite} className="management-invite-form"><label htmlFor="student-invite-code">{t('Código do profissional')}</label><TextField id="student-invite-code" placeholder={t('Ex.: A1B2C3D4E5')} autoComplete="off" value={code} disabled={accepting || !auth.user?.id} onChange={event => { setCode(normalizeInviteCode(event.target.value)); setSubmitted({ code: '', revision: submitted.revision + 1 }); setActionError('') }} /><div className="row-actions"><Button type="submit" disabled={busy || accepting || !auth.user?.id}>{t('Continuar')}</Button><Link className="management-button" to="/student/professionals">{t('Cancelar')}</Link></div></form>
    </ManagementPanel>
    {busy && <p role="status">{t('Consultando convite…')}</p>}
    {!busy && data && !preview && data.code === code && <ManagementPanel title={t('Convite indisponível')}><p role="alert">{t('Convite inválido ou expirado.')}</p><p className="muted">{t('Peça um novo código ao profissional.')}</p></ManagementPanel>}
    {preview && <ManagementPanel title={t('Confira antes de vincular')}><div className="management-person-strip"><ManagementAvatar name={preview.professional_name} /><div><h2>{preview.professional_name}</h2><p>{preview.bio || t('Perfil profissional')}</p>{preview.specialties?.length > 0 && <p className="muted">{preview.specialties.join(' · ')}</p>}<p className="muted">{t('Verificação: {0}', studentVerificationLabel(preview.verification_status))}</p></div></div><Button variant="primary" disabled={accepting || busy} onClick={accept}>{t(accepting ? 'Vinculando…' : 'Vincular a este profissional')}</Button></ManagementPanel>}
  </ManagementLayout>
}
