import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBrowserSupabaseClient } from '../../lib/supabase-client.js'
import { createCommunityModerationRepository, COMMUNITY_REASON_LABELS, COMMUNITY_DURATION_OPTIONS, COMMUNITY_STATUS_LABELS } from '../../lib/community-moderation.js'
import { useConsoleAccess } from './ConsoleAccess.jsx'
import useConsoleResource from './useConsoleResource.js'
import { Alert, Chip, Loading, fmtDateTime } from './ConsoleUI.jsx'

export function CommunityRestrictionDetails({ row }) {
  return <div className="console-field-stack">
    <div><Chip tone={row.revoked_at || row.status === 'expired' ? 'neutral' : 'warn'}>{COMMUNITY_STATUS_LABELS[row.status] || (row.ends_at ? 'Temporário' : 'Permanente')}</Chip></div>
    <p><strong>Motivo:</strong> {COMMUNITY_REASON_LABELS[row.reason] || row.reason}</p>
    {row.admin_message && <p className="cx-community-message">{row.admin_message}</p>}
    <p className="cx-muted">Administrador: {row.admin_name || row.created_by || '—'}<br />Criado: {fmtDateTime(row.created_at)}<br />Início: {fmtDateTime(row.starts_at)}<br />Término: {row.ends_at ? fmtDateTime(row.ends_at) : 'Permanente'}</p>
    {row.revoked_at && <p className="cx-muted">Revogado: {fmtDateTime(row.revoked_at)} · {row.revoked_by || '—'}<br />Motivo: {row.revoke_reason || '—'}</p>}
    <p className="cx-muted">Origem: {row.source_ticket_id ? 'Denúncia / chamado' : 'Aplicação direta pelo Console'}</p>
    {row.source_ticket_id && <Link className="console-text-link" to={`/console/support/${row.source_ticket_id}`}>Ver chamado de origem</Link>}
  </div>
}

export default function CommunityModerationPanel({ targetUserId, sourceTicketId = null, initialReason = 'other', onChanged = undefined, collapsible = false, canRestrict = true }) {
  const { userId, allowed } = useConsoleAccess()
  const repo = useMemo(() => createCommunityModerationRepository(getBrowserSupabaseClient()), [])
  const identity = `${userId}:${targetUserId}:${sourceTicketId}:${allowed}`
  const current = useRef(identity); current.current = identity
  useEffect(() => {
    current.current = identity
    return () => { current.current = null }
  }, [identity])
  const [duration, setDuration] = useState('24h')
  const [reason, setReason] = useState(COMMUNITY_REASON_LABELS[initialReason] ? initialReason : 'other')
  const [adminMessage, setAdminMessage] = useState('')
  const [revokeReason, setRevokeReason] = useState('')
  const [action, setAction] = useState({ identity: '', busy: false, error: '', success: '' })
  const lock = useRef(false)
  const { data, busy, error, refresh } = useConsoleResource({ userId, allowed, resourceKey: `community:${targetUserId}:${sourceTicketId || ''}`, load: () => repo.status(targetUserId) })
  const scopedAction = action.identity === identity ? action : {}
  const perform = async revoke => {
    if (lock.current || !allowed || !targetUserId) return
    lock.current = true
    const scope = identity
    setAction({ identity: scope, busy: true, error: '', success: '' })
    try {
      if (revoke) await repo.unrestrict({ userId: targetUserId, reason: revokeReason, sourceTicketId })
      else await repo.restrict({ userId: targetUserId, duration, reason, adminMessage, sourceTicketId })
      if (current.current !== scope) return
      setAction({ identity: scope, busy: false, error: '', success: revoke ? 'Acesso à Comunidade liberado.' : 'Bloqueio da Comunidade aplicado.' })
      refresh()
      onChanged?.()
    } catch { if (current.current === scope) setAction({ identity: scope, busy: false, error: 'Não foi possível concluir a alteração. Tente novamente.', success: '' }) }
    finally { lock.current = false }
  }
  if (!allowed || !targetUserId) return null
  const content = <div className="console-panel-content console-field-stack fpp-console-moderation" aria-label="Moderação da Comunidade">
    <h3>Comunidade</h3>
    <Link className="console-text-link" to={`/console/users/${targetUserId}`}>Ver usuário moderado</Link>
    {error && <Alert onRetry={refresh}>{error}</Alert>}
    {scopedAction.error && <Alert>{scopedAction.error}</Alert>}
    {scopedAction.success && <div className="cx-success" role="status">{scopedAction.success}</div>}
    {busy ? <Loading /> : data && <>
      <p>{data.active ? 'Bloqueio ativo na Comunidade.' : 'Sem bloqueio ativo na Comunidade.'}</p>
      {data.active && <CommunityRestrictionDetails row={data.active} />}
      {canRestrict ? <form className="console-field-stack" onSubmit={event => { event.preventDefault(); void perform(false) }}>
        <strong>{data.active ? 'Gerenciar bloqueio' : 'Bloquear da Comunidade'}</strong>
        <label className="cx-label">Duração<select className="cx-field" value={duration} disabled={scopedAction.busy} onChange={event => setDuration(event.target.value)}>{COMMUNITY_DURATION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="cx-label">Motivo<select className="cx-field" value={reason} disabled={scopedAction.busy} onChange={event => setReason(event.target.value)}>{Object.entries(COMMUNITY_REASON_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="cx-label">Mensagem ao usuário (opcional)<textarea className="cx-field cx-field--ta" rows={3} maxLength={500} value={adminMessage} disabled={scopedAction.busy} onChange={event => setAdminMessage(event.target.value)} /><span>{adminMessage.length}/500</span></label>
        <button className="cx-pill-btn cx-pill-btn--danger" type="submit" disabled={scopedAction.busy} aria-busy={scopedAction.busy || undefined}>{data.active ? 'Atualizar bloqueio' : 'Bloquear da Comunidade'}</button>
      </form> : <p>Administradores não podem receber bloqueio da Comunidade.</p>}
      {data.active && <form className="console-field-stack" onSubmit={event => { event.preventDefault(); void perform(true) }}>
        <label className="cx-label">Motivo da liberação<textarea className="cx-field cx-field--ta" rows={2} required maxLength={500} value={revokeReason} disabled={scopedAction.busy} onChange={event => setRevokeReason(event.target.value)} /></label>
        <button type="submit" className="cx-pill-btn" disabled={scopedAction.busy || !revokeReason.trim()}>Liberar acesso à Comunidade</button>
      </form>}
      <details><summary>Histórico de bloqueios ({data.history?.length || 0})</summary><div className="console-field-stack">{data.history?.length ? data.history.map(row => <div className="cx-community-history" key={row.id}><CommunityRestrictionDetails row={row} /></div>) : <p className="cx-muted">Nenhum bloqueio registrado.</p>}</div></details>
    </>}
  </div>
  return collapsible ? <details><summary>{busy?'Carregando situação da Comunidade…':data?.active?'Gerenciar bloqueio da Comunidade':'Bloquear da Comunidade'}</summary>{content}</details> : content
}
