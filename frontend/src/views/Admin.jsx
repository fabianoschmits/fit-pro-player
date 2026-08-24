import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { fmtDate, fmtNum, fmtVol, fmtDur } from '../lib/format.js'
import { auditCat, auditLine, fmtWhen } from '../lib/audit.js'
import { workoutVolume, setsDone } from '../lib/history.js'
import { confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { getLang } from '../lib/i18n.js'

// Admin-only operator dashboard (owner passkey + admin flag; guarded again server-side).
// Complete pt-BR coverage lives beside this operator-only surface, while the existing
// English fallback remains available in the other language modes.
const a = (english, portuguese) => getLang() === 'pt' ? portuguese : english

const rel = ts => {
  if (!ts) return a('never', 'nunca')
  const s = Math.max(0, (Date.now() - ts) / 1000)
  if (s < 60) return a('just now', 'agora mesmo')
  if (s < 3600) return a(Math.floor(s / 60) + 'm ago', 'há ' + Math.floor(s / 60) + ' min')
  if (s < 86400) return a(Math.floor(s / 3600) + 'h ago', 'há ' + Math.floor(s / 3600) + ' h')
  return a(Math.floor(s / 86400) + 'd ago', 'há ' + Math.floor(s / 86400) + ' d')
}
const dur = ms => { const m = Math.max(0, Math.floor(ms / 60000)); return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h' + (m % 60) + 'm' }

function UserDetail({ id, onChanged, close }) {
  const [d, setD] = useState(null)
  const toast = useUI(s => s.toast)
  useEffect(() => { api('/api/admin/user?id=' + encodeURIComponent(id)).then(setD).catch(e => toast(e.message)) }, [id])
  if (!d) return <div className="muted small">{a('Loading…', 'Carregando…')}</div>
  const u = d.user
  const setDisabled = disabled => {
    api('/api/admin/user/disable', { method: 'POST', body: JSON.stringify({ id: u.id, disabled }) })
      .then(() => { toast(disabled ? a('User disabled', 'Usuário desativado') : a('User enabled', 'Usuário ativado')); onChanged(); close() })
      .catch(e => toast(e.message))
  }
  return <>
    <h3 className="capitalize">{u.name}</h3>
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '8px 0 12px' }}>
      {u.admin && <span className="tag acc">{a('admin', 'administrador')}</span>}
      {u.disabled && <span className="tag" style={{ color: 'var(--red)' }}>{a('disabled', 'desativado')}</span>}
      {u.invitedBy && <span className="tag">{a('invite', 'convite')} {u.invitedBy}</span>}
      <span className="tag">{a('joined', 'entrou em')} {u.created ? fmtDate(u.created.slice(0, 10)) : '—'}</span>
    </div>
    <div className="tiles" style={{ textAlign: 'left' }}>
      <div className="tile"><div className="l">{a('Workouts', 'Treinos')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{d.workouts.length}</div></div>
      <div className="tile"><div className="l">{a('Weigh-ins', 'Pesagens')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{d.bodyweight.length}</div></div>
      <div className="tile"><div className="l">{a('Routines', 'Rotinas')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{d.routines.length}</div></div>
      <div className="tile"><div className="l">{a('Last sync', 'Última sincronização')}</div><div className="v" style={{ fontSize: '.95rem' }}>{rel(d.lastSync)}</div></div>
    </div>
    {!u.admin && <button className={'btn ' + (u.disabled ? 'primary' : 'danger')} style={{ margin: '12px 0 4px' }}
      onClick={() => u.disabled ? setDisabled(false)
        : confirmSheet({ title: a('Disable ', 'Desativar ') + u.name + '?', message: a('They are signed out everywhere and can no longer sync or log in until re-enabled.', 'A conta será desconectada de todos os dispositivos e não poderá sincronizar nem entrar até ser reativada.'), confirmText: a('Disable', 'Desativar'), danger: true, onConfirm: () => setDisabled(true) })}>
      {u.disabled ? a('Enable account', 'Ativar conta') : a('Disable account', 'Desativar conta')}</button>}
    <h4 className="sec">{a('Workout history', 'Histórico de treinos')}</h4>
    {d.workouts.length ? <div className="list" style={{ gap: 0 }}>
      {d.workouts.slice(0, 60).map(w => <div key={w.id} className="row between" style={{ padding: '9px 2px', borderBottom: '1px solid var(--sep)' }}>
        <div><div className="small" style={{ fontWeight: 600 }}>{w.name}</div>
          <div className="dim" style={{ fontSize: '.72rem' }}>{fmtDate(w.d, true)} · {fmtDur((w.end || w.start) - w.start)} · {setsDone(w)} {a('sets', 'séries')}{w.prs?.length ? ' · ' + w.prs.length + ' RP' : ''}</div></div>
        <span className="small muted">{fmtVol(w.vol ?? workoutVolume(w), d.unit)}</span>
      </div>)}
    </div> : <div className="empty small">{a('No workouts logged.', 'Nenhum treino registrado.')}</div>}
  </>
}

function InvitesCard({ invites, reload }) {
  const toast = useUI(s => s.toast)
  const gen = () => api('/api/admin/invites/new', { method: 'POST', body: '{}' })
    .then(({ invite }) => { navigator.clipboard?.writeText(invite.code).catch(() => {}); toast(a('Code ', 'Código ') + invite.code + a(' created & copied', ' criado e copiado')); reload() })
    .catch(e => toast(e.message))
  const revoke = code => api('/api/admin/invites/revoke', { method: 'POST', body: JSON.stringify({ code }) })
    .then(() => { toast(a('Code revoked', 'Código revogado')); reload() }).catch(e => toast(e.message))
  const open = (invites || []).filter(i => !i.usedBy)
  const used = (invites || []).filter(i => i.usedBy)
  return <div className="card">
    <div className="row between"><h2 style={{ margin: 0 }}>{a('Invite codes', 'Códigos de convite')}</h2>
      <Button variant="primary" size="sm" onClick={gen} icon="plus">{a('Generate', 'Gerar')}</Button></div>
    <div className="small muted" style={{ margin: '6px 0 10px' }}>{open.length} {a('unused', 'não utilizados')} · {used.length} {a('redeemed', 'utilizados')}</div>
    {open.map(i => <div key={i.code} className="row between" style={{ padding: '7px 2px', borderBottom: '1px solid var(--sep)' }}>
      <span style={{ fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontWeight: 500, letterSpacing: '.06em' }}
        onClick={() => { navigator.clipboard?.writeText(i.code).catch(() => {}); toast(a('Copied ', 'Copiado: ') + i.code) }}>{i.code}</span>
      <button className="iconbtn" style={{ width: 32, height: 30, borderRadius: 8, fontSize: 15, color: 'var(--red)' }} onClick={() => revoke(i.code)} aria-label={a('revoke', 'revogar')}><Icon name="trash" /></button>
    </div>)}
    {used.map(i => <div key={i.code} className="row between dim" style={{ padding: '7px 2px', fontSize: '.8rem' }}>
      <span style={{ fontFamily: 'monospace' }}>{i.code}</span><span>→ {i.usedByName || a('used', 'utilizado')}</span>
    </div>)}
    {!open.length && !used.length && <div className="dim small">{a('No codes yet — generate one to invite someone.', 'Nenhum código ainda — gere um para convidar alguém.')}</div>}
  </div>
}

// Who signed in, who tried and failed, what an admin changed. A card rather than its own route:
// the dashboard is deliberately one page of cards, and the 95 % use of this is a glance at the
// last twenty events. Paging follows Library.jsx's house style — "Show more", not page numbers.
function AuditCard({ tick }) {
  const toast = useUI(s => s.toast)
  const [meta, setMeta] = useState(null)      // last response minus the rows: total, retention, …
  const [rows, setRows] = useState([])
  const [cat, setCat] = useState('')

  const load = (c, before) => api('/api/admin/audit?limit=50&cat=' + c + (before ? '&before=' + before : ''))
    .then(r => { setMeta(r); setRows(x => (before ? x.concat(r.events) : r.events)) })
    .catch(e => toast(e.message))
  const pick = c => { setCat(c); setRows([]); setMeta(null); load(c) }
  // Reloads on mount and whenever the header's ↻ bumps the tick. Deliberately not on the 15s
  // poll that drives "training now": this is history, not presence.
  useEffect(() => { load(cat) }, [tick])

  const clear = () => confirmSheet({
    title: a('Clear the activity log?', 'Limpar o registro de atividades?'),
    message: a('Every recorded event is deleted. The clear itself is logged, so the gap stays visible.', 'Todos os eventos registrados serão excluídos. A própria limpeza fica registrada, portanto a lacuna permanece visível.'),
    confirmText: a('Clear', 'Limpar'), danger: true,
    onConfirm: () => api('/api/admin/audit/clear', { method: 'POST', body: '{}' })
      .then(() => { toast(a('Activity log cleared', 'Registro de atividades limpo')); pick(cat) }).catch(e => toast(e.message))
  })

  if (meta && !meta.enabled) return null      // AUDIT_LOG=0 — the card isn't there at all

  return <div className="card">
    <div className="row between"><h2 style={{ margin: 0 }}>{a('Activity log', 'Registro de atividades')}</h2>
      <button className="iconbtn" style={{ width: 32, height: 30, borderRadius: 8, fontSize: 15, color: 'var(--red)' }}
        onClick={clear} aria-label={a('clear log', 'limpar registro')}><Icon name="trash" /></button></div>
    <div className="small muted" style={{ margin: '6px 0 10px' }}>
      {meta ? fmtNum(meta.total) + a(' events', ' eventos')
        + (meta.retention.days ? a(' · last ', ' · últimos ') + meta.retention.days + a(' days', ' dias') : '')
        + (meta.ip_mode === 'off' ? a(' · no IP addresses', ' · sem endereços IP') : '') : a('Loading…', 'Carregando…')}</div>
    <div className="chips" style={{ marginBottom: 10 }}>
      {[['', a('All', 'Todos')], ['auth', a('Sign-ins', 'Acessos')], ['admin', a('Admin', 'Administração')], ['fail', a('Failed', 'Falhas')]].map(([v, l]) =>
        <button key={v} className={'chip' + (cat === v ? ' on' : '')} onClick={() => pick(v)}>{l}</button>)}
    </div>
    {rows.map(e => {
      const line = auditLine(e)
      return <div key={e.id} className="row between" style={{ padding: '8px 2px', borderBottom: '1px solid var(--sep)' }}>
        <div className="grow">
          <div className="small" style={{ fontWeight: 600 }}>{line.title}
            {/* a red pill, not a red row: twenty fumbled Face IDs in a row shouldn't read as an incident */}
            {!e.ok && <span className="tag" style={{ marginLeft: 6, color: 'var(--red)' }}>{a('failed', 'falhou')}</span>}
            {auditCat(e.ev) === 'admin' && <span className="tag acc" style={{ marginLeft: 6 }}>{a('admin', 'administração')}</span>}</div>
          {line.sub && <div className="dim" style={{ fontSize: '.72rem' }}>{line.sub}</div>}
        </div>
        <span className="small muted" style={{ flex: 'none', marginLeft: 8 }}>{fmtWhen(e.ts, meta?.now)}</span>
      </div>
    })}
    {meta && !rows.length && <div className="dim small">{a('Nothing logged yet.', 'Nada registrado ainda.')}</div>}
    {meta?.nextBefore && <div style={{ marginTop: 10 }}>
      <Button size="sm" onClick={() => load(cat, meta.nextBefore)}>{a('Show more', 'Mostrar mais')}</Button></div>}
  </div>
}

export default function Admin() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  const [users, setUsers] = useState(null)
  const [invites, setInvites] = useState(null)
  const [inviteOnly, setInviteOnly] = useState(false)
  const [tick, setTick] = useState(0)          // the ↻ button; the activity log listens to it

  const loadUsers = () => api('/api/admin/users').then(d => { setUsers(d.users); setInviteOnly(d.invite_only) }).catch(e => toast(e.message || a('Failed to load', 'Falha ao carregar')))
  const loadInvites = () => api('/api/admin/invites').then(d => setInvites(d.invites)).catch(() => {})
  // poll every 15s so the "training now" section stays live without a manual refresh
  useEffect(() => { if (!user?.admin) return; loadUsers(); loadInvites(); const iv = setInterval(loadUsers, 15000); return () => clearInterval(iv) }, [])
  if (!user?.admin) return null

  const openUser = id => openSheet(close => <UserDetail id={id} onChanged={loadUsers} close={close} />)
  const liveUsers = (users || []).filter(u => u.live)
  const activeCount = (users || []).filter(u => u.lastSync && Date.now() - u.lastSync < 7 * 86400000).length
  const disabledCount = (users || []).filter(u => u.disabled).length

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={a('Back', 'Voltar')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 8 }}><h1 style={{ margin: 0 }}>Admin</h1>
        <div className="sub">{users ? users.length + a(' users · ', ' usuários · ') + activeCount + a(' active this week', ' ativos nesta semana') : a('Loading…', 'Carregando…')}</div></div>
      <button className="iconbtn" onClick={() => { loadUsers(); loadInvites(); setTick(n => n + 1) }} aria-label={a('refresh', 'atualizar')}>↻</button>
    </div>

    <div className="tiles" style={{ marginBottom: 12 }}>
      <div className="tile"><div className="l">{a('Users', 'Usuários')}</div><div className="v">{users ? users.length : '—'}</div></div>
      <div className="tile"><div className="l">{a('Training now', 'Treinando agora')}</div><div className="v" style={{ color: liveUsers.length ? 'var(--acc)' : undefined }}>{users ? liveUsers.length : '—'}</div></div>
      <div className="tile"><div className="l">{a('Active 7d', 'Ativos em 7 dias')}</div><div className="v">{users ? activeCount : '—'}</div></div>
      <div className="tile"><div className="l">{a('Disabled', 'Desativados')}</div><div className="v">{users ? disabledCount : '—'}</div></div>
    </div>

    {liveUsers.length > 0 && <div className="card" style={{ borderColor: 'var(--acc)' }}>
      <h2 className="row" style={{ margin: '0 0 8px', gap: 6 }}><Icon name="dot" style={{ fontSize: 10, color: 'var(--green)' }} />{a('Training now', 'Treinando agora')}</h2>
      {liveUsers.map(u => <div key={u.id} className="row between" style={{ padding: '8px 2px', borderBottom: '1px solid var(--sep)' }} onClick={() => openUser(u.id)}>
        <div><div className="small" style={{ fontWeight: 600 }}>{u.name}</div>
          <div className="dim" style={{ fontSize: '.72rem' }}>{u.live.name} · ex. {u.live.exIdx}/{u.live.exTotal} · {u.live.setsDone}/{u.live.setsTotal} {a('sets', 'séries')}</div></div>
        <span className="tag acc">{dur(Date.now() - u.live.startedAt)}</span>
      </div>)}
    </div>}

    <InvitesCard invites={invites} reload={loadInvites} />

    <h4 className="sec">{a('Users', 'Usuários')}</h4>
    <div className="list">
      {(users || []).map(u => <div key={u.id} className="item" onClick={() => openUser(u.id)} style={u.disabled ? { opacity: .55 } : null}>
        <div className="grow"><div className="tt">{u.live && <Icon name="dot" style={{ fontSize: 9, color: 'var(--green)', display: 'inline-block', marginRight: 5 }} />}{u.name} {u.admin && <span className="tag acc" style={{ marginLeft: 4 }}>{a('admin', 'admin')}</span>}{u.disabled && <span className="tag" style={{ marginLeft: 4, color: 'var(--red)' }}>{a('off', 'desativado')}</span>}</div>
          <div className="ss">{u.live ? a('training now · ', 'treinando agora · ') + u.live.name : u.workouts + a(' workouts', ' treinos') + (u.lastWorkout ? a(' · last ', ' · último em ') + fmtDate(u.lastWorkout) : '') + a(' · synced ', ' · sincronizado ') + rel(u.lastSync)}</div></div>
        {u.hasPush && <Icon name="bell" title={a('push enabled', 'notificações ativadas')} style={{ fontSize: 15, color: 'var(--label-3)' }} />}<Icon name="chevronRight" className="chev" />
      </div>)}
      {users && !users.length && <div className="empty">{a('No users yet.', 'Nenhum usuário ainda.')}</div>}
    </div>

    <div style={{ marginTop: 14 }}><AuditCard tick={tick} /></div>
  </div>
}
