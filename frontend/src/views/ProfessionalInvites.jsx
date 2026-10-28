import InviteQrCode from '../components/InviteQrCode.jsx'
import Link from '../components/ManagementLink.jsx'
import { t } from '../lib/i18n.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { inviteLink, normalizeInviteCode, professionalDate, statusLabel } from '../lib/professional-ux.js'
import { Button } from '../components/ui.jsx'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { ManagementPanel, ManagementEmpty, ManagementStatus } from '../components/ManagementUI.jsx'
import { FppActionFeedback, FppSkeleton } from '../components/FppFeedback.jsx'

const copyText = async value => {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value)
  const input = document.createElement('textarea'); input.value = value; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select()
  try { if (!document.execCommand('copy')) throw new Error('copy-failed') }
  finally { input.remove() }
}

export default function ProfessionalInvites() {
  const auth = useAuth()
  return <InvitesWorkspace key={auth.user?.id || 'anonymous'} userId={auth.user?.id} />
}
function InvitesWorkspace({ userId }) {
  const [params, setParams] = useSearchParams(); const creating = params.get('section') === 'create'; const selectedCode = params.get('code')
  const currentContext = useRef(params.toString()); currentContext.current = params.toString()
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const mounted = useRef(true)
  const savingRef = useRef(false)
  const [invites, setInvites] = useState([]); const [busy, setBusy] = useState(Boolean(userId)); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [confirmId, setConfirmId] = useState('')
  const refresh = async () => { setBusy(true); setError(''); try { const rows = await repo.invites(); if (mounted.current) setInvites(rows) } catch { if (mounted.current) setError(t('Não foi possível carregar os convites.')) } finally { if (mounted.current) setBusy(false) } }
  useEffect(() => { mounted.current = true; if (userId) refresh(); return () => { mounted.current = false } }, [userId])
  const create = async () => {
    if (savingRef.current) return false
    savingRef.current = true
    const requestContext = currentContext.current
    setSaving(true); setError(''); setMessage('')
    try { const result = await repo.createInvite('code'); if (!mounted.current) return false; const invite = Array.isArray(result) ? result[0] : result; const code = normalizeInviteCode(invite?.code); if (!code) throw new Error('missing-code'); setMessage(t('Convite criado. Compartilhe o código abaixo.')); setInvites(items => items.some(item => normalizeInviteCode(item.code) === code) ? items : [{ ...invite, code, status: 'pending' }, ...items]); return { code, requestContext, invite } }
    catch (cause) { if (mounted.current) setError(t('Não foi possível criar o convite.')); throw cause }
    finally { savingRef.current = false; if (mounted.current) setSaving(false) }
  }
  const created = async ({ code, requestContext, invite }) => {
    if (!mounted.current) return
    await refresh()
    if (!mounted.current) return
    setInvites(items => items.some(item => normalizeInviteCode(item.code) === code) ? items : [{ ...invite, code, status: 'pending' }, ...items])
    if (currentContext.current === requestContext) setParams({ section: 'result', code })
  }
  const revoke = async id => { if (savingRef.current) return false; savingRef.current = true; setSaving(true); setError(''); try { await repo.revokeInvite(id); if (!mounted.current) return false; return true } catch (cause) { if (mounted.current) setError(t('Não foi possível revogar este convite.')); throw cause } finally { savingRef.current = false; if (mounted.current) setSaving(false) } }
  const revoked = async () => { if (!mounted.current) return; setConfirmId(''); setMessage(t('Convite revogado.')); await refresh() }
  const share = async (code, kind) => {
    setError(''); setMessage('')
    const link = inviteLink(window.location.origin, code)
    try { if (kind === 'share') await navigator.share({ title: t('Convite Fit Pro Player'), url: link }); else { await copyText(kind === 'code' ? code : link); if (mounted.current) setMessage(t(kind === 'code' ? 'Código copiado.' : 'Link copiado.')) } }
    catch (err) { if (err?.name === 'AbortError') return false; if (mounted.current) setError(t('Não foi possível compartilhar o convite. Tente novamente.')); throw err }
  }
  const pending = invites.filter(item => item.status === 'pending')
  const selected = selectedCode ? invites.find(item => normalizeInviteCode(item.code) === normalizeInviteCode(selectedCode)) : null
  const visible = selectedCode ? selected ? [selected] : [] : pending
  return <ManagementLayout className="professional-page" title={creating ? t('Convidar aluno') : t('Convites')} subtitle={t('Convide alunos para criar um vínculo')} backTo={creating || selectedCode ? '/professional/invites' : '/professional'} action={!creating && !selectedCode && <Link className="management-button management-button-primary" to="/professional/invites?section=create">{t('Convidar aluno')}</Link>}>
    {error && <p role="alert" className="management-error">{error} <Button intent="quick" onClick={refresh}>{t('Tentar novamente')}</Button></p>}{message && <FppActionFeedback state="success" className="management-notice">{message}</FppActionFeedback>}
    {!userId ? <ManagementEmpty title={t('Entre na sua conta para continuar.')} /> : creating ? <ManagementPanel title={t('Novo convite')}><p className="muted">{t('Crie um único convite e compartilhe o mesmo código ou link. O vínculo só nasce depois que o aluno confirmar.')}</p><div className="row-actions"><Button variant="primary" intent="primary" onAction={create} onSuccess={created} disabled={saving || busy} loadingLabel={t('Criando…')} successLabel={t('Convite criado.')} errorLabel={t('Tentar novamente')}>{t('Gerar convite')}</Button><Link className="management-button" to="/professional/invites">{t('Cancelar')}</Link></div></ManagementPanel> : busy ? <FppSkeleton label={t('Carregando convites…')} /> : <ManagementPanel title={selectedCode ? t('Compartilhar convite') : t('Pendentes ({0})', pending.length)}>
      {!visible.length && <ManagementEmpty title={t(selectedCode ? 'Convite não encontrado.' : 'Nenhum convite pendente.')} description={t('Crie um convite para começar.')} action={<Link className="management-button" to="/professional/invites?section=create">{t('Convidar aluno')}</Link>} />}
      <div className="management-invite-list">{visible.map(item => { const code = normalizeInviteCode(item.code); return <article className="management-invite" key={item.id || code}>{item.status === 'pending' && <InviteQrCode value={inviteLink(window.location.origin, code)} />}<div className="management-record-heading"><strong className="invite-code">{code}</strong><ManagementStatus tone={item.status === 'pending' ? 'success' : 'neutral'}>{statusLabel(item.status)}</ManagementStatus></div><p className="muted small">{t('Criado em {0}', professionalDate(item.created_at))}</p>{item.status === 'pending' && <><div className="row-actions"><Button intent="quick" onAction={() => share(code, 'code')} successLabel={t('Código copiado.')} errorLabel={t('Tentar novamente')}>{t('Copiar código')}</Button><Button variant="primary" icon="link" intent="quick" onAction={() => share(code, 'link')} successLabel={t('Link copiado.')} errorLabel={t('Tentar novamente')}>{t('Copiar link')}</Button>{navigator.share && <Button intent="quick" onAction={() => share(code, 'share')} errorLabel={t('Tentar novamente')}>{t('Compartilhar')}</Button>}</div>{confirmId === item.id ? <div className="danger-confirm"><span>{t('Revogar este convite?')}</span><Button variant="danger" intent="critical" disabled={saving} onAction={() => revoke(item.id)} onSuccess={revoked} successLabel={t('Convite revogado.')} errorLabel={t('Tentar novamente')}>{t('Confirmar')}</Button><Button activation="immediate" disabled={saving} onClick={() => setConfirmId('')}>{t('Cancelar')}</Button></div> : item.id && <Button variant="ghost" onClick={() => setConfirmId(item.id)}>{t('Revogar')}</Button>}</>}</article> })}</div>
      {selectedCode && <Link className="management-button" to="/professional/invites">{t('Voltar para convites')}</Link>}
    </ManagementPanel>}
  </ManagementLayout>
}
