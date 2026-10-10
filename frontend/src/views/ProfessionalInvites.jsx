import { t } from '../lib/i18n.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { inviteLink, normalizeInviteCode, professionalDate, statusLabel } from '../lib/professional-ux.js'
import { Button } from '../components/ui.jsx'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { ManagementPanel, ManagementEmpty, ManagementStatus } from '../components/ManagementUI.jsx'
import FilterChips from '../features/professional/components/FilterChips.jsx'
import Skeleton from '../features/professional/components/Skeleton.jsx'

const copyText = async value => {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value)
  const input = document.createElement('textarea'); input.value = value; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select(); document.execCommand('copy'); input.remove()
}

export default function ProfessionalInvites() {
  const auth = useAuth()
  return <InvitesWorkspace key={auth.user?.id || 'anonymous'} userId={auth.user?.id} />
}
function InvitesWorkspace({ userId }) {
  const [params, setParams] = useSearchParams(); const creating = params.get('section') === 'create'; const selectedCode = params.get('code'); const statusFilter = params.get('status') || 'pending'
  const currentContext = useRef(params.toString()); currentContext.current = params.toString()
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const mounted = useRef(true)
  const [invites, setInvites] = useState([]); const [busy, setBusy] = useState(Boolean(userId)); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [confirmId, setConfirmId] = useState('')
  const refresh = async () => { setBusy(true); setError(''); try { const rows = await repo.invites(); if (mounted.current) setInvites(rows) } catch { if (mounted.current) setError(t('Não foi possível carregar os convites.')) } finally { if (mounted.current) setBusy(false) } }
  useEffect(() => { mounted.current = true; if (userId) refresh(); return () => { mounted.current = false } }, [userId])
  const create = async () => {
    if (saving) return
    const requestContext = currentContext.current
    setSaving(true); setError(''); setMessage('')
    try { const result = await repo.createInvite('code'); if (!mounted.current) return; const invite = Array.isArray(result) ? result[0] : result; const code = normalizeInviteCode(invite?.code); if (!code) throw new Error('missing-code'); setMessage(t('Convite criado. Compartilhe o código abaixo.')); await refresh(); if (!mounted.current) return; setInvites(items => items.some(item => normalizeInviteCode(item.code) === code) ? items : [{ ...invite, code, status: 'pending' }, ...items]); if (currentContext.current === requestContext) setParams({ section: 'result', code }) }
    catch { if (mounted.current) setError(t('Não foi possível criar o convite.')) }
    finally { if (mounted.current) setSaving(false) }
  }
  const revoke = async id => { if (saving) return; setSaving(true); try { await repo.revokeInvite(id); if (!mounted.current) return; setConfirmId(''); setMessage(t('Convite revogado.')); await refresh() } catch { if (mounted.current) setError(t('Não foi possível revogar este convite.')) } finally { if (mounted.current) setSaving(false) } }
  const share = async (code, kind) => {
    const link = inviteLink(window.location.origin, code)
    try { if (kind === 'share') await navigator.share({ title: t('Convite Fit Pro Player'), url: link }); else { await copyText(kind === 'code' ? code : link); if (mounted.current) setMessage(t(kind === 'code' ? 'Código copiado.' : 'Link copiado.')) } }
    catch (err) { if (mounted.current && err?.name !== 'AbortError') setError(t('Não foi possível compartilhar o convite. Tente novamente.')) }
  }
  const effectiveStatus = item => item.status === 'pending' && item.expires_at && new Date(item.expires_at) <= new Date() ? 'expired' : ({ active: 'accepted', revoked: 'cancelled' })[item.status] || item.status
  const inviteStatusLabel = status => ({ accepted: t('Aceito'), cancelled: t('Cancelado'), expired: t('Expirado') })[status] || statusLabel(status)
  const pending = invites.filter(item => effectiveStatus(item) === 'pending')
  const selected = selectedCode ? invites.find(item => normalizeInviteCode(item.code) === normalizeInviteCode(selectedCode)) : null
  const visible = selectedCode ? selected ? [selected] : [] : invites.filter(item => effectiveStatus(item) === statusFilter)
  return <ManagementLayout className="professional-page" title={creating ? t('Convidar aluno') : t('Convites')} subtitle={t('Convide alunos para criar um vínculo')} backTo={creating || selectedCode ? '/professional/invites' : '/professional'} action={!creating && !selectedCode && <Link className="management-button management-button-primary" to="/professional/invites?section=create">{t('Convidar aluno')}</Link>}>
    {error && <p role="alert" className="management-error">{error} <button className="link" onClick={refresh}>{t('Tentar novamente')}</button></p>}{message && <p role="status" className="management-notice">{message}</p>}
    {!userId ? <ManagementEmpty title={t('Entre na sua conta para continuar.')} /> : creating ? <ManagementPanel title={t('Novo convite')}><p className="muted">{t('Crie um único convite e compartilhe o mesmo código ou link. O vínculo só nasce depois que o aluno confirmar.')}</p><div className="row-actions"><Button variant="primary" onClick={create} disabled={saving || busy}>{t(saving ? 'Criando…' : 'Gerar convite')}</Button><Link className="management-button" to="/professional/invites">{t('Cancelar')}</Link></div></ManagementPanel> : busy ? <Skeleton variant="rows" label={t('Carregando convites…')} /> : <ManagementPanel title={selectedCode ? t('Compartilhar convite') : statusFilter === 'pending' ? t('Pendentes ({0})', visible.length) : t('Convites ({0})', visible.length)}>
      {!selectedCode && <FilterChips options={[['pending','Pendentes'],['accepted','Aceitos'],['expired','Expirados'],['cancelled','Cancelados']].map(([value,label]) => ({ value, label: t(label) }))} value={statusFilter} onChange={status => { const next = new URLSearchParams(params); next.set('status', status); setParams(next) }} />}
      {!visible.length && <ManagementEmpty title={t(selectedCode ? 'Convite não encontrado.' : 'Nenhum convite pendente.')} description={t('Crie um convite para começar.')} action={<Link className="management-button" to="/professional/invites?section=create">{t('Convidar aluno')}</Link>} />}
      <div className="management-invite-list">{visible.map(item => { const code = normalizeInviteCode(item.code), status = effectiveStatus(item); return <article className="management-invite" key={item.id || code}><div className="management-record-heading"><strong className="invite-code">{code}</strong><ManagementStatus tone={status === 'pending' ? 'success' : 'neutral'}>{inviteStatusLabel(status)}</ManagementStatus></div><p className="muted small">{t('Criado em {0}', professionalDate(item.created_at))}</p>{status === 'pending' && <><div className="row-actions"><Button onClick={() => share(code, 'code')}>{t('Copiar código')}</Button><Button onClick={() => share(code, 'link')}>{t('Copiar link')}</Button>{navigator.share && <Button onClick={() => share(code, 'share')}>{t('Compartilhar')}</Button>}</div>{confirmId === item.id ? <div className="danger-confirm"><span>{t('Revogar este convite?')}</span><Button variant="danger" disabled={saving} onClick={() => revoke(item.id)}>{t('Confirmar')}</Button><Button disabled={saving} onClick={() => setConfirmId('')}>{t('Cancelar')}</Button></div> : item.id && <Button variant="ghost" onClick={() => setConfirmId(item.id)}>{t('Revogar')}</Button>}</>}</article> })}</div>
      {selectedCode && <Link className="management-button" to="/professional/invites">{t('Voltar para convites')}</Link>}
    </ManagementPanel>}
  </ManagementLayout>
}
