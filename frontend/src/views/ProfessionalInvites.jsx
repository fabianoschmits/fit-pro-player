import { t } from '../lib/i18n.js'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { inviteLink, normalizeInviteCode, statusLabel } from '../lib/professional-ux.js'
import { Button, Section } from '../components/ui.jsx'
import AppHeader from '../components/AppHeader.jsx'
import ProfessionalWorkspaceNav from '../components/ProfessionalWorkspaceNav.jsx'

const copyText = async value => {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value)
  const input = document.createElement('textarea'); input.value = value; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select(); document.execCommand('copy'); input.remove()
}

export default function ProfessionalInvites() {
  const auth = useAuth()
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const [invites, setInvites] = useState([]); const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [confirmId, setConfirmId] = useState('')
  const refresh = () => { setBusy(true); return repo.invites().then(setInvites).catch(() => setError(t('Não foi possível carregar os convites.'))).finally(() => setBusy(false)) }
  useEffect(() => { if (auth.user?.id) refresh() }, [auth.user?.id])
  const create = async () => { setError(''); setMessage(''); try { await repo.createInvite('code'); setMessage(t('Convite criado. Compartilhe o código abaixo.')); await refresh() } catch { setError(t('Não foi possível criar o convite.')) } }
  const revoke = async id => { try { await repo.revokeInvite(id); setConfirmId(''); setMessage(t('Convite revogado.')); await refresh() } catch { setError(t('Não foi possível revogar este convite.')) } }
  const pending = invites.filter(item => item.status === 'pending')
  return <div className="narrow professional-page">
    <AppHeader title={t("Convites")} subtitle={t("Convide alunos para criar um vínculo")} backTo="/professional" />
    <ProfessionalWorkspaceNav />
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}
    <Section title={t("Convidar aluno")}><p className="muted">{t("Crie um único convite e compartilhe o mesmo código ou link. O vínculo só nasce depois que o aluno confirmar.")}</p><Button variant="primary" onClick={create} disabled={busy}>{t("Convidar aluno")}</Button></Section>
    {busy ? <p role="status">{t("Carregando convites…")}</p> : <Section title={`Pendentes (${pending.length})`}>
      {!pending.length && <p className="muted">{t("Nenhum convite pendente. Crie um convite para começar.")}</p>}
      <div className="professional-invite-list">{pending.map(item => { const code = normalizeInviteCode(item.code); const link = inviteLink(window.location.origin, code); return <article className="card professional-invite-card" key={item.id}><div className="row between"><strong className="invite-code">{code}</strong><span className="status-pill">{statusLabel(item.status)}</span></div><small className="muted">Criado em {String(item.created_at || '').slice(0, 10) || '—'}</small><div className="row-actions"><Button onClick={() => copyText(code).then(() => setMessage(t('Código copiado.')))}>{t("Copiar código")}</Button><Button onClick={() => copyText(link).then(() => setMessage(t('Link copiado.')))}>{t("Copiar link")}</Button>{navigator.share && <Button onClick={() => navigator.share({ title: t('Convite Fit Pro Player'), url: link })}>{t("Compartilhar")}</Button>}</div>{confirmId === item.id ? <div className="danger-confirm"><span>{t("Revogar este convite?")}</span><Button variant="danger" onClick={() => revoke(item.id)}>{t("Confirmar")}</Button><Button onClick={() => setConfirmId('')}>{t("Cancelar")}</Button></div> : <Button variant="ghost" onClick={() => setConfirmId(item.id)}>{t("Revogar")}</Button>}</article> })}</div>
    </Section>}
  </div>
}
