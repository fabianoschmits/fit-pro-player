import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBrowserSupabaseClient } from '../../lib/supabase-client.js'
import { createCommunityModerationRepository, COMMUNITY_STATUS_LABELS, COMMUNITY_DURATION_OPTIONS } from '../../lib/community-moderation.js'
import ConsoleShell from './ConsoleLayout.jsx'
import { AccessGate, useConsoleAccess } from './ConsoleAccess.jsx'
import useConsoleResource from './useConsoleResource.js'
import CommunityModerationPanel, { CommunityRestrictionDetails } from './CommunityModerationPanel.jsx'
import { Alert, Empty, Loading, SectionBody } from './ConsoleUI.jsx'

export default function ConsoleCommunity() {
  const { userId, allowed } = useConsoleAccess()
  const repo = useMemo(() => createCommunityModerationRepository(getBrowserSupabaseClient()), [])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [duration, setDuration] = useState('all')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState(null)
  const { data, busy, error, refresh } = useConsoleResource({ userId, allowed, resourceKey: `restrictions:${search}:${status}:${duration}:${offset}`, load: () => repo.list({ search, status, duration, offset, limit: 30 }) })
  const change = (setter, value) => { setter(value); setOffset(0); setSelected(null) }
  return <AccessGate allowed={allowed}><ConsoleShell userId={userId} allowed={allowed}><div className="cx-page-body fpp-console-page fpp-console-page--community">
    <div className="cx-page-head"><h1 className="cx-page-title">Moderação da Comunidade</h1><p className="cx-page-sub">Bloqueios ativos e histórico. Para aplicar um bloqueio, abra o perfil do usuário ou o chamado da denúncia.</p></div>
    <Link className="console-text-link" to="/console/users">Buscar usuário para moderar</Link>
    <div className="cx-form-grid">
      <label className="cx-label">Buscar usuário<input type="search" className="cx-field" placeholder="Nome ou ID…" value={search} onChange={event => change(setSearch, event.target.value)} /></label>
      <label className="cx-label">Status<select className="cx-field" value={status} onChange={event => change(setStatus, event.target.value)}>{Object.entries(COMMUNITY_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="cx-label">Duração<select className="cx-field" value={duration} onChange={event => change(setDuration, event.target.value)}><option value="all">Todas as durações</option>{COMMUNITY_DURATION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {error && <Alert onRetry={refresh}>{error}</Alert>}
    <button type="button" className="cx-pill-btn" onClick={refresh} disabled={busy}>Atualizar lista</button>
    {busy ? <Loading /> : !data?.items?.length ? <Empty title="Nenhum bloqueio encontrado" sub="Ajuste os filtros ou a busca." /> : <>
      {data.items.map(row => <SectionBody key={row.id}>
        <div className="console-panel-content console-field-stack"><Link className="console-text-link" to={`/console/users/${row.user_id}`}>{row.display_name || row.user_id}</Link><CommunityRestrictionDetails row={row} />
          <button type="button" className="cx-pill-btn" onClick={() => setSelected(selected === row.id ? null : row.id)}>{selected === row.id ? 'Fechar gerenciamento' : 'Gerenciar / liberar acesso'}</button>
          {selected === row.id && <CommunityModerationPanel key={`${row.user_id}:${row.id}`} targetUserId={row.user_id} onChanged={refresh} />}
        </div>
      </SectionBody>)}
      <div className="cx-action-list cx-action-list--row fpp-spaced-actions"><button type="button" className="cx-pill-btn" disabled={offset === 0} onClick={() => { setOffset(value => Math.max(0, value - 30)); setSelected(null) }}>Página anterior</button><span className="cx-muted">Página {offset / 30 + 1}</span><button type="button" className="cx-pill-btn" disabled={!data.hasMore} onClick={() => { setOffset(value => value + 30); setSelected(null) }}>Próxima página</button></div>
    </>}
  </div></ConsoleShell></AccessGate>
}
